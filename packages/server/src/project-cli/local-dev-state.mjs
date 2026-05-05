import { spawnSync } from "node:child_process";
import path from "node:path";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const DEVTOOLS_SCHEMA_VERSION = 1;
const KNOWN_LOCAL_DEV_PORTS = [4000, 5173];
const KNOWN_PORTS_ENV = "AIRJAM_DEVTOOLS_KNOWN_PORTS";

const isProcessAlive = (pid) => {
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

const runCommandResult = ({ command, args, cwd }) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      CI: process.env.CI ?? "1",
      NO_UPDATE_NOTIFIER: "1",
    },
  });

  const exitCode = result.status ?? null;
  return {
    exitCode,
    ok: exitCode === 0 && !result.error,
    stdout: result.stdout ?? "",
    stderr:
      result.stderr ??
      (result.error instanceof Error ? result.error.message : ""),
  };
};

const readCommandOutput = (command, args, cwd) => {
  try {
    return runCommandResult({ command, args, cwd }).stdout.trim();
  } catch {
    return null;
  }
};

const readListeningPidsForPort = (port, cwd) => {
  const output = readCommandOutput(
    "lsof",
    ["-nP", `-tiTCP:${port}`, "-sTCP:LISTEN"],
    cwd,
  );
  if (!output) {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
};

const readProcessCommand = (pid, cwd) => {
  const output = readCommandOutput(
    "ps",
    ["-p", String(pid), "-o", "command="],
    cwd,
  );
  return output && output.length > 0 ? output : null;
};

const readProcessAgeMs = (pid, cwd) => {
  const output = readCommandOutput(
    "ps",
    ["-p", String(pid), "-o", "etimes="],
    cwd,
  );
  const seconds = output ? Number.parseInt(output.trim(), 10) : Number.NaN;
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : null;
};

const getKnownLocalDevPorts = () => {
  const rawPorts = process.env[KNOWN_PORTS_ENV];
  if (!rawPorts) {
    return [...KNOWN_LOCAL_DEV_PORTS];
  }

  const ports = rawPorts
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  return ports.length > 0 ? Array.from(new Set(ports)) : [...KNOWN_LOCAL_DEV_PORTS];
};

const isLikelyAirJamLocalDevCommand = (command) => {
  if (!command) {
    return false;
  }

  return /(^|\W)(@air-jam\/server|air-jam-server|airjam|vite|create-airjam|workspace-runtime-cli)(\W|$)/.test(
    command,
  );
};

const listKnownPortListeners = (cwd) => {
  const byPid = new Map();

  for (const port of getKnownLocalDevPorts()) {
    for (const pid of readListeningPidsForPort(port, cwd)) {
      const ports = byPid.get(pid) ?? new Set();
      ports.add(port);
      byPid.set(pid, ports);
    }
  }

  return Array.from(byPid.entries())
    .map(([pid, ports]) => {
      const ageMs = readProcessAgeMs(pid, cwd);
      return {
        pid,
        ports: Array.from(ports).sort((left, right) => left - right),
        command: readProcessCommand(pid, cwd),
        startedAt:
          ageMs !== null ? new Date(Date.now() - ageMs).toISOString() : null,
        ageMs,
        managed: false,
      };
    })
    .sort((left, right) => left.pid - right.pid);
};

const killManagedProcess = (pid) => {
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

const pathExists = async (targetPath) => existsSync(targetPath);

const readPackageJson = async (rootDir) => {
  const packageJsonPath = path.join(rootDir, "package.json");
  if (!(await pathExists(packageJsonPath))) {
    return null;
  }

  return JSON.parse(await readFile(packageJsonPath, "utf8"));
};

const isMonorepoRoot = async (rootDir, packageJson) => {
  if (packageJson?.name !== "air-jam") {
    return false;
  }

  return (
    (await pathExists(path.join(rootDir, "scripts", "repo", "cli.mjs"))) &&
    (await pathExists(path.join(rootDir, "packages", "sdk"))) &&
    (await pathExists(path.join(rootDir, "packages", "create-airjam")))
  );
};

const findProjectRoot = async (cwd) => {
  let currentDir = path.resolve(cwd);

  while (true) {
    const packageJson = await readPackageJson(currentDir);
    if (await isMonorepoRoot(currentDir, packageJson)) {
      return currentDir;
    }

    if (packageJson) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return path.resolve(cwd);
    }
    currentDir = parentDir;
  }
};

const getDevtoolsRoot = (rootDir) => path.join(rootDir, ".airjam", "devtools");

const getManagedRegistryPath = (rootDir) =>
  path.join(getDevtoolsRoot(rootDir), "managed-processes.json");

const readRegistry = async (rootDir) => {
  const registryPath = getManagedRegistryPath(rootDir);
  if (!(await pathExists(registryPath))) {
    return {
      schemaVersion: DEVTOOLS_SCHEMA_VERSION,
      processes: [],
    };
  }

  const parsed = JSON.parse(await readFile(registryPath, "utf8"));
  return {
    schemaVersion: DEVTOOLS_SCHEMA_VERSION,
    processes: Array.isArray(parsed.processes) ? parsed.processes : [],
  };
};

const writeRegistry = async (rootDir, registry) => {
  const registryPath = getManagedRegistryPath(rootDir);
  await mkdir(path.dirname(registryPath), { recursive: true });
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
};

const listManagedProcessesForRoot = async (rootDir) => {
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

const stopDev = async ({ cwd, processId, mode } = {}) => {
  const rootDir = await findProjectRoot(cwd ?? process.cwd());
  const processes = await listManagedProcessesForRoot(rootDir);
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
  await writeRegistry(rootDir, {
    schemaVersion: DEVTOOLS_SCHEMA_VERSION,
    processes: remaining,
  });

  return {
    rootDir,
    stopped: selected,
  };
};

export const getDevStatus = async ({ cwd = process.cwd() } = {}) => {
  const rootDir = await findProjectRoot(cwd);
  const managedProcesses = await listManagedProcessesForRoot(rootDir);
  const managedPids = new Set(managedProcesses.map((entry) => entry.pid));
  return {
    processes: managedProcesses,
    unmanagedProcesses: listKnownPortListeners(rootDir).filter(
      (entry) => !managedPids.has(entry.pid),
    ),
    knownPorts: getKnownLocalDevPorts(),
  };
};

export const resetLocalDev = async ({ cwd = process.cwd() } = {}) => {
  const { rootDir, stopped: stoppedManaged } = await stopDev({ cwd });
  const managedPids = new Set(stoppedManaged.map((entry) => entry.pid));
  const unmanaged = listKnownPortListeners(rootDir).filter(
    (entry) => !managedPids.has(entry.pid),
  );
  const stoppedUnmanaged = [];

  for (const processInfo of unmanaged) {
    if (!isLikelyAirJamLocalDevCommand(processInfo.command)) {
      continue;
    }
    killManagedProcess(processInfo.pid);
    stoppedUnmanaged.push(processInfo);
  }

  await rm(path.join(rootDir, ".airjam", "preview-managed-server.json"), {
    force: true,
  }).catch(() => undefined);

  const stoppedPids = new Set([
    ...stoppedManaged.map((entry) => entry.pid),
    ...stoppedUnmanaged.map((entry) => entry.pid),
  ]);
  const remainingUnmanaged = listKnownPortListeners(rootDir).filter(
    (entry) => !stoppedPids.has(entry.pid),
  );

  return {
    stoppedManaged,
    stoppedUnmanaged,
    remainingUnmanaged,
    knownPorts: getKnownLocalDevPorts(),
  };
};
