import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { openSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { runCommandResult } from "./commands.js";
import { detectProjectContext } from "./context.js";
import { pathExists } from "./fs-utils.js";
import { inspectGame, listGames } from "./games.js";
import type {
  AirJamDevMode,
  AirJamDevStatus,
  AirJamManagedDevProcess,
  AirJamProjectContext,
  AirJamRuntimeTopology,
  AirJamSurfaceUrlSummary,
  GetDevStatusOptions,
  GetTopologyOptions,
  JsonObject,
  StartDevOptions,
  StartDevResult,
  StopDevOptions,
  StopDevResult,
} from "./types.js";

type ManagedRegistry = {
  schemaVersion: 1;
  processes: AirJamManagedDevProcess[];
};

type RawTopologyCommandResult = {
  gameId?: unknown;
  mode?: unknown;
  secure?: unknown;
  surfaces?: unknown;
};

const DEVTOOLS_SCHEMA_VERSION = 1 as const;
const START_TIMEOUT_MS = 120_000;
const DEFAULT_CONTROLLER_PATH = "/controller";
const MONOREPO_RUNTIME_CLI_PATH = path.join(
  "packages",
  "devtools-core",
  "runtime",
  "workspace-runtime-cli.mjs",
);

const toTopologyMode = (
  mode: AirJamDevMode,
): "standalone-dev" | "arcade-live" | "arcade-built" => {
  if (mode === "arcade-dev") {
    return "arcade-live";
  }
  if (mode === "arcade-test") {
    return "arcade-built";
  }
  return "standalone-dev";
};

const isKnownProjectMode = (
  mode: AirJamProjectContext["mode"],
): mode is "monorepo" | "standalone-game" =>
  mode === "monorepo" || mode === "standalone-game";

const getDevtoolsRoot = (rootDir: string): string =>
  path.join(rootDir, ".airjam", "devtools");

const getManagedRegistryPath = (rootDir: string): string =>
  path.join(getDevtoolsRoot(rootDir), "managed-processes.json");

const getManagedProcessLogPath = (rootDir: string, processId: string): string =>
  path.join(getDevtoolsRoot(rootDir), "processes", `${processId}.log`);

const isProcessAlive = (pid: number): boolean => {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const killManagedProcess = (pid: number): void => {
  if (!Number.isInteger(pid) || pid <= 0) {
    return;
  }

  try {
    if (process.platform !== "win32") {
      process.kill(-pid, "SIGTERM");
      return;
    }
  } catch {
    // Fall through to direct kill below.
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Best effort only.
  }
};

const readRegistry = async (rootDir: string): Promise<ManagedRegistry> => {
  const registryPath = getManagedRegistryPath(rootDir);
  if (!(await pathExists(registryPath))) {
    return {
      schemaVersion: DEVTOOLS_SCHEMA_VERSION,
      processes: [],
    };
  }

  const parsed = JSON.parse(
    await readFile(registryPath, "utf8"),
  ) as Partial<ManagedRegistry>;

  return {
    schemaVersion: DEVTOOLS_SCHEMA_VERSION,
    processes: Array.isArray(parsed.processes) ? parsed.processes : [],
  };
};

const writeRegistry = async (
  rootDir: string,
  registry: ManagedRegistry,
): Promise<void> => {
  const registryPath = getManagedRegistryPath(rootDir);
  await mkdir(path.dirname(registryPath), { recursive: true });
  await writeFile(
    registryPath,
    `${JSON.stringify(registry, null, 2)}\n`,
    "utf8",
  );
};

const listManagedProcessesForRoot = async (
  rootDir: string,
): Promise<AirJamManagedDevProcess[]> => {
  const registry = await readRegistry(rootDir);
  const aliveProcesses = registry.processes.filter((processInfo) =>
    isProcessAlive(processInfo.pid),
  );

  if (aliveProcesses.length !== registry.processes.length) {
    await writeRegistry(rootDir, {
      schemaVersion: DEVTOOLS_SCHEMA_VERSION,
      processes: aliveProcesses,
    });
  }

  return aliveProcesses.sort((left, right) =>
    left.startedAt.localeCompare(right.startedAt),
  );
};

const appendArg = (args: string[], flag: string, value?: string | boolean) => {
  if (value === undefined || value === false || value === "") {
    return;
  }

  if (value === true) {
    args.push(flag);
    return;
  }

  args.push(`${flag}=${value}`);
};

const resolveMonorepoRuntimeCliPath = (rootDir: string): string =>
  path.join(rootDir, MONOREPO_RUNTIME_CLI_PATH);

const resolveRequestedGameId = async ({
  cwd,
  context,
  gameId,
}: {
  cwd: string;
  context: AirJamProjectContext;
  gameId?: string;
}): Promise<string | null> => {
  if (context.mode === "standalone-game") {
    return (await inspectGame({ cwd, gameId })).id;
  }

  if (context.mode !== "monorepo") {
    return null;
  }

  if (gameId) {
    return gameId;
  }

  const games = await listGames({ cwd });
  if (games.some((game) => game.id === "air-capture")) {
    return "air-capture";
  }

  return games[0]?.id ?? null;
};

const resolveStartCommand = async ({
  context,
  cwd,
  gameId,
  mode,
  secure,
}: {
  context: AirJamProjectContext;
  cwd: string;
  gameId: string | null;
  mode: AirJamDevMode;
  secure: boolean;
}): Promise<{
  command: string;
  args: string[];
  topologyMode: "standalone-dev" | "arcade-live" | "arcade-built";
  expectedLogPath: string | null;
}> => {
  if (context.mode === "monorepo") {
    if (!gameId) {
      throw new Error("Monorepo dev start requires a game id.");
    }

    const script =
      mode === "arcade-dev"
        ? "arcade-dev"
        : mode === "arcade-test"
          ? "arcade-test"
          : "standalone-dev";

    const args = [
      resolveMonorepoRuntimeCliPath(cwd),
      script,
      `--game=${gameId}`,
    ];
    appendArg(args, "--secure", secure);

    return {
      command: process.execPath,
      args,
      topologyMode: toTopologyMode(mode),
      expectedLogPath: path.join(cwd, ".airjam", "logs", "dev-latest.ndjson"),
    };
  }

  if (context.mode !== "standalone-game") {
    throw new Error(
      "Air Jam dev start is only available in known project modes.",
    );
  }

  if (mode !== "standalone-dev") {
    throw new Error(
      `Mode "${mode}" is only available in the Air Jam monorepo.`,
    );
  }

  const args =
    context.packageJson?.scripts?.dev !== undefined
      ? ["run", "dev"]
      : ["exec", "airjam", "dev"];
  if (secure) {
    args.push("--", "--secure");
  }

  return {
    command: "pnpm",
    args,
    topologyMode: "standalone-dev",
    expectedLogPath: path.join(cwd, ".airjam", "logs", "dev-latest.ndjson"),
  };
};

const parseJsonFromCommandOutput = <T>(output: string): T => {
  const startIndex = output.indexOf("{");
  const endIndex = output.lastIndexOf("}");
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Expected JSON output but received:\n${output}`);
  }

  return JSON.parse(output.slice(startIndex, endIndex + 1)) as T;
};

const resolveTopologyCommand = async ({
  context,
  gameId,
  mode,
  secure,
}: {
  context: AirJamProjectContext;
  gameId: string | null;
  mode: AirJamDevMode;
  secure: boolean;
}): Promise<{
  command: string;
  args: string[];
  topologyMode: "standalone-dev" | "arcade-live" | "arcade-built";
}> => {
  const topologyMode = toTopologyMode(mode);

  if (context.mode === "monorepo") {
    if (!gameId) {
      throw new Error("Monorepo topology inspection requires a game id.");
    }

    const args = [
      resolveMonorepoRuntimeCliPath(context.rootDir),
      "topology",
      `--game=${gameId}`,
      `--mode=${topologyMode}`,
    ];
    appendArg(args, "--secure", secure);

    return {
      command: process.execPath,
      args,
      topologyMode,
    };
  }

  if (context.mode !== "standalone-game") {
    throw new Error(
      "Air Jam topology is only available in known project modes.",
    );
  }

  const args =
    context.packageJson?.scripts?.topology !== undefined
      ? ["run", "topology", "--", "--mode=standalone-dev"]
      : ["exec", "airjam", "topology", "--mode=standalone-dev"];
  appendArg(args, "--secure", secure);

  return {
    command: "pnpm",
    args,
    topologyMode,
  };
};

const toObject = (value: unknown): JsonObject =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};

const toStringOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null;

const joinUrl = (origin: string | null, pathname: string): string | null => {
  if (!origin) {
    return null;
  }

  return new URL(pathname, origin).toString();
};

const buildUrlSummary = ({
  mode,
  gameId,
  surfaces,
  controllerPath,
}: {
  mode: AirJamDevMode;
  gameId: string | null;
  surfaces: Record<string, JsonObject>;
  controllerPath: string;
}): AirJamSurfaceUrlSummary => {
  if (mode === "standalone-dev") {
    const hostSurface = toObject(surfaces.host);
    const controllerSurface = toObject(surfaces.controller);
    const hostOrigin = toStringOrNull(hostSurface.appOrigin);
    const controllerOrigin =
      toStringOrNull(controllerSurface.appOrigin) ?? hostOrigin;
    const publicHost =
      toStringOrNull(hostSurface.publicHost) ??
      toStringOrNull(controllerSurface.publicHost) ??
      hostOrigin;

    return {
      appOrigin: hostOrigin,
      hostUrl: hostOrigin,
      controllerBaseUrl: joinUrl(controllerOrigin, controllerPath),
      publicHost,
      localBuildUrl: null,
      browserBuildUrl: null,
    };
  }

  const platformHost = toObject(surfaces.platformHost);
  const platformController = toObject(surfaces.platformController);
  const embeddedHost = toObject(surfaces.embeddedHost);
  const appOrigin = toStringOrNull(platformHost.appOrigin);
  const controllerOrigin =
    toStringOrNull(platformController.appOrigin) ??
    toStringOrNull(platformHost.publicHost) ??
    appOrigin;
  const publicHost =
    toStringOrNull(platformHost.publicHost) ??
    toStringOrNull(platformController.publicHost) ??
    controllerOrigin;
  const assetBasePath = toStringOrNull(embeddedHost.assetBasePath);

  return {
    appOrigin,
    hostUrl:
      appOrigin && gameId
        ? new URL(`/arcade/local-${gameId}`, appOrigin).toString()
        : null,
    controllerBaseUrl: joinUrl(controllerOrigin, DEFAULT_CONTROLLER_PATH),
    publicHost,
    localBuildUrl:
      mode === "arcade-test" && publicHost && assetBasePath
        ? new URL(assetBasePath, publicHost).toString()
        : null,
    browserBuildUrl:
      mode === "arcade-test" && appOrigin && assetBasePath
        ? new URL(assetBasePath, appOrigin).toString()
        : null,
  };
};

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const checkUrlReady = (targetUrl: string, secure: boolean): Promise<boolean> =>
  new Promise((resolve) => {
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === "https:" ? https : http;
    const request = client.request(
      parsed,
      {
        method: "GET",
        rejectUnauthorized: secure ? false : undefined,
      },
      (response) => {
        response.resume();
        resolve(Boolean(response.statusCode && response.statusCode < 500));
      },
    );

    request.setTimeout(2_500, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
    request.end();
  });

const waitForTopologyReady = async ({
  topology,
  timeoutMs = START_TIMEOUT_MS,
}: {
  topology: AirJamRuntimeTopology;
  timeoutMs?: number;
}): Promise<void> => {
  const urls = [topology.urls.hostUrl, topology.urls.controllerBaseUrl].filter(
    (value): value is string => Boolean(value),
  );
  if (urls.length === 0) {
    return;
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const statuses = await Promise.all(
      urls.map((targetUrl) => checkUrlReady(targetUrl, topology.secure)),
    );
    if (statuses.every(Boolean)) {
      return;
    }
    await wait(500);
  }

  throw new Error(
    `Timed out waiting for Air Jam dev endpoints: ${urls.join(", ")}`,
  );
};

const readManagedProcessLogTail = async (
  logPath: string,
  maxLines = 60,
): Promise<string> => {
  if (!(await pathExists(logPath))) {
    return "";
  }

  const contents = await readFile(logPath, "utf8");
  return contents.split(/\r?\n/).filter(Boolean).slice(-maxLines).join("\n");
};

export const getDevStatus = async ({
  cwd = process.cwd(),
}: GetDevStatusOptions = {}): Promise<AirJamDevStatus> => {
  const context = await detectProjectContext({ cwd });
  return {
    processes: await listManagedProcessesForRoot(context.rootDir),
  };
};

export const getTopology = async ({
  cwd = process.cwd(),
  gameId,
  mode = "standalone-dev",
  secure = false,
}: GetTopologyOptions = {}): Promise<AirJamRuntimeTopology> => {
  const context = await detectProjectContext({ cwd });
  if (!isKnownProjectMode(context.mode)) {
    throw new Error(
      "Air Jam topology is only available in recognized Air Jam projects.",
    );
  }

  const resolvedGameId = await resolveRequestedGameId({
    cwd,
    context,
    gameId,
  });
  const game =
    resolvedGameId !== null
      ? await inspectGame({ cwd, gameId: resolvedGameId })
      : null;
  const controllerPath = game?.controllerPathLikely ?? DEFAULT_CONTROLLER_PATH;
  const topologyCommand = await resolveTopologyCommand({
    context,
    gameId: resolvedGameId,
    mode,
    secure,
  });
  const topologyResult = runCommandResult({
    command: topologyCommand.command,
    args: topologyCommand.args,
    cwd: context.rootDir,
  });

  if (!topologyResult.ok) {
    throw new Error(
      `Failed to inspect Air Jam topology.\n\n${topologyResult.stderr || topologyResult.stdout}`,
    );
  }

  const parsed = parseJsonFromCommandOutput<RawTopologyCommandResult>(
    topologyResult.stdout,
  );
  const surfaces = toObject(parsed.surfaces) as Record<string, JsonObject>;
  const processes = await listManagedProcessesForRoot(context.rootDir);
  const matchingProcess =
    processes.find(
      (processInfo) =>
        processInfo.mode === mode &&
        processInfo.secure === secure &&
        processInfo.gameId === resolvedGameId,
    ) ?? null;

  return {
    projectMode: context.mode,
    mode,
    topologyMode: topologyCommand.topologyMode,
    gameId: resolvedGameId,
    secure,
    surfaces,
    urls: buildUrlSummary({
      mode,
      gameId: resolvedGameId,
      surfaces,
      controllerPath,
    }),
    process: matchingProcess,
  };
};

export const startDev = async ({
  cwd = process.cwd(),
  gameId,
  mode = "standalone-dev",
  secure = false,
}: StartDevOptions = {}): Promise<StartDevResult> => {
  const context = await detectProjectContext({ cwd });
  if (!isKnownProjectMode(context.mode)) {
    throw new Error(
      "Air Jam dev start is only available in recognized Air Jam projects.",
    );
  }

  const resolvedGameId = await resolveRequestedGameId({
    cwd,
    context,
    gameId,
  });
  const existingProcesses = await listManagedProcessesForRoot(context.rootDir);
  const exactMatch =
    existingProcesses.find(
      (processInfo) =>
        processInfo.mode === mode &&
        processInfo.secure === secure &&
        processInfo.gameId === resolvedGameId,
    ) ?? null;
  if (exactMatch) {
    return {
      process: exactMatch,
      reusedExistingProcess: true,
      topology: await getTopology({
        cwd: context.rootDir,
        gameId: resolvedGameId ?? undefined,
        mode,
        secure,
      }),
    };
  }

  if (existingProcesses.length > 0) {
    throw new Error(
      `Air Jam devtools already manages ${existingProcesses.length} running dev process(es) in ${context.rootDir}. Stop them first with airjam.stop_dev.`,
    );
  }

  const startCommand = await resolveStartCommand({
    context,
    cwd: context.rootDir,
    gameId: resolvedGameId,
    mode,
    secure,
  });
  const processId = randomUUID();
  const logPath = getManagedProcessLogPath(context.rootDir, processId);
  await mkdir(path.dirname(logPath), { recursive: true });
  const logFd = openSync(logPath, "a");
  const child = spawn(startCommand.command, startCommand.args, {
    cwd: context.rootDir,
    detached: process.platform !== "win32",
    stdio: ["ignore", logFd, logFd],
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
      NO_UPDATE_NOTIFIER: "1",
    },
  });
  child.unref();

  const managedProcess: AirJamManagedDevProcess = {
    id: processId,
    pid: child.pid ?? 0,
    cwd: context.rootDir,
    projectMode: context.mode,
    mode,
    topologyMode: startCommand.topologyMode,
    secure,
    gameId: resolvedGameId,
    command: startCommand.command,
    args: startCommand.args,
    logPath,
    expectedLogPath: startCommand.expectedLogPath,
    startedAt: new Date().toISOString(),
  };

  await writeRegistry(context.rootDir, {
    schemaVersion: DEVTOOLS_SCHEMA_VERSION,
    processes: [managedProcess],
  });

  try {
    const topology = await getTopology({
      cwd: context.rootDir,
      gameId: resolvedGameId ?? undefined,
      mode,
      secure,
    });
    await waitForTopologyReady({ topology });
    return {
      process: managedProcess,
      reusedExistingProcess: false,
      topology,
    };
  } catch (error) {
    killManagedProcess(managedProcess.pid);
    await writeRegistry(context.rootDir, {
      schemaVersion: DEVTOOLS_SCHEMA_VERSION,
      processes: [],
    });
    const logTail = await readManagedProcessLogTail(logPath);
    const message =
      error instanceof Error ? error.message : String(error ?? "Unknown error");
    throw new Error(
      logTail ? `${message}\n\nManaged dev log tail:\n${logTail}` : message,
    );
  }
};

export const stopDev = async ({
  cwd = process.cwd(),
  processId,
  mode,
}: StopDevOptions = {}): Promise<StopDevResult> => {
  const context = await detectProjectContext({ cwd });
  const processes = await listManagedProcessesForRoot(context.rootDir);
  const selected = processes.filter((processInfo) => {
    if (processId) {
      return processInfo.id === processId;
    }
    if (mode) {
      return processInfo.mode === mode;
    }
    return true;
  });

  for (const processInfo of selected) {
    killManagedProcess(processInfo.pid);
  }

  const remaining = processes.filter(
    (processInfo) =>
      !selected.some(
        (selectedProcess) => selectedProcess.id === processInfo.id,
      ),
  );
  await writeRegistry(context.rootDir, {
    schemaVersion: DEVTOOLS_SCHEMA_VERSION,
    processes: remaining,
  });

  return {
    stopped: selected,
  };
};
