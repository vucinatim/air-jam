import type {
  DevHarnessInvokeResponse,
  DevHarnessSessionRecord,
  DevHarnessSessionsResponse,
} from "@air-jam/harness/dev-control";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCommandResult } from "./commands.js";
import { getTopology, startDev, stopDev } from "./dev.js";
import { pathExists, readJsonFile } from "./fs-utils.js";
import { inspectGame, readVisualCaptureSummary } from "./games.js";
import { inspectAirJamMachineConfig } from "./tooling/airjam-machine-inspection.js";
import type {
  AirJamHarnessActionInvocation,
  AirJamHarnessSessionList,
  AirJamHarnessSessionRecord,
  AirJamHarnessSnapshotInspection,
  AirJamVisualCaptureInspection,
  AirJamVisualScenarioList,
  AirJamVisualScenarioMetadata,
  CaptureVisualsOptions,
  CaptureVisualsResult,
  InvokeHarnessActionOptions,
  ListHarnessSessionsOptions,
  ListVisualScenariosOptions,
  ReadHarnessSnapshotOptions,
} from "./types.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_HARNESS_SESSIONS_PATH = "/__airjam/dev/harness/sessions";
const DEV_HARNESS_INVOKE_PATH = "/__airjam/dev/harness/invoke";

const resolveHelperScriptPath = (fileName: string): string => {
  const builtHelperPath = path.resolve(__dirname, "tooling", fileName);
  if (existsSync(builtHelperPath)) {
    return builtHelperPath;
  }

  return path.resolve(__dirname, "..", "src", "tooling", fileName);
};

const resolveTsxCliPath = (): string =>
  path.join(
    path.dirname(require.resolve("tsx/package.json")),
    "dist",
    "cli.mjs",
  );

type ResolvedVisualSource = {
  configPath: string;
  scenarioModulePath: string;
};

const resolveVisualArtifactRoot = (rootDir: string): string =>
  path.join(rootDir, ".airjam", "artifacts", "visual");

const normalizeSessionMode = (
  topologyMode: "standalone-dev" | "arcade-live" | "arcade-built",
): "standalone-dev" | "arcade-live" | "arcade-built" => topologyMode;

const normalizeRoomId = (roomId: string | undefined): string | undefined => {
  const trimmed = roomId?.trim().toUpperCase();
  return trimmed ? trimmed : undefined;
};

const withTargetRoomId = ({
  hostUrl,
  roomId,
}: {
  hostUrl: string;
  roomId?: string;
}): string => {
  if (!roomId) {
    return hostUrl;
  }

  const nextUrl = new URL(hostUrl);
  nextUrl.searchParams.set("room", roomId);
  return nextUrl.toString();
};

const requireTopologyHostUrl = (
  topology: Awaited<ReturnType<typeof getTopology>>,
): string => {
  if (!topology.urls.hostUrl) {
    throw new Error("Resolved topology is missing a host URL.");
  }

  return topology.urls.hostUrl;
};

const parseHelperJson = <T>(output: string): T => {
  const startIndex = output.indexOf("{");
  const endIndex = output.lastIndexOf("}");
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Expected JSON helper output but received:\n${output}`);
  }

  return JSON.parse(output.slice(startIndex, endIndex + 1)) as T;
};

const runTsxHelper = <T>({
  helperFile,
  args,
  cwd,
}: {
  helperFile: string;
  args: string[];
  cwd: string;
}): T => {
  const result = runCommandResult({
    command: process.execPath,
    args: [resolveTsxCliPath(), helperFile, ...args],
    cwd,
  });

  if (!result.ok) {
    throw new Error(
      `Air Jam helper failed.\n\n${result.stderr || result.stdout}`,
    );
  }

  return parseHelperJson<T>(result.stdout);
};

const resolveVisualSource = async ({
  configPath,
}: {
  configPath: string | null;
}): Promise<ResolvedVisualSource | null> => {
  if (configPath) {
    const scenarioModulePath = await inspectAirJamMachineConfig(
      configPath,
    ).then((inspection) => inspection.visualScenariosModulePath);
    if (scenarioModulePath) {
      return {
        configPath,
        scenarioModulePath,
      };
    }
  }

  return null;
};

const readScenarioMetadata = async ({
  artifactRoot,
  summary,
}: {
  artifactRoot: string;
  summary: AirJamVisualCaptureInspection["summary"];
}): Promise<AirJamVisualScenarioMetadata[]> => {
  const metadataEntries = await Promise.all(
    summary.scenarios.map(async (scenario) => {
      const metadataPath = path.join(
        artifactRoot,
        scenario.relativeDir,
        "metadata.json",
      );
      if (!(await pathExists(metadataPath))) {
        return null;
      }

      return readJsonFile<AirJamVisualScenarioMetadata>(metadataPath);
    }),
  );

  return metadataEntries.filter(
    (entry): entry is AirJamVisualScenarioMetadata => entry !== null,
  );
};

const resolveHarnessServiceOrigin = (
  topology: Awaited<ReturnType<typeof getTopology>>,
): string => {
  const origin =
    topology.urls.appOrigin ??
    topology.urls.hostUrl ??
    topology.urls.publicHost;
  if (!origin) {
    throw new Error(
      "Resolved topology is missing an app origin for harness control.",
    );
  }

  return origin.replace(/\/$/, "");
};

const mapRegisteredHarnessSession = (
  session: DevHarnessSessionRecord,
): AirJamHarnessSessionRecord => ({
  sessionId: session.sessionId,
  gameId: session.gameId,
  role: session.role,
  roomId: session.roomId,
  origin: session.origin,
  href: session.href,
  title: session.title,
  actions: session.actions.map((action) => ({
    name: action.name,
    description: action.description ?? null,
    payload: {
      kind: action.payload.kind,
      description: action.payload.description ?? null,
      ...(action.payload.allowedValues
        ? { allowedValues: [...action.payload.allowedValues] }
        : {}),
    },
    resultDescription: action.resultDescription ?? null,
  })),
  availableActions: [...session.actionNames],
  snapshot:
    session.snapshot && typeof session.snapshot === "object"
      ? (session.snapshot as Record<string, unknown>)
      : null,
  registeredAt: session.registeredAt,
  lastSeenAt: session.lastSeenAt,
});

const readRegisteredHarnessSessions = async ({
  topology,
  gameId,
  roomId,
}: {
  topology: Awaited<ReturnType<typeof getTopology>>;
  gameId?: string;
  roomId?: string;
}): Promise<AirJamHarnessSessionRecord[]> => {
  const endpoint = new URL(
    DEV_HARNESS_SESSIONS_PATH,
    resolveHarnessServiceOrigin(topology),
  );
  if (gameId) {
    endpoint.searchParams.set("gameId", gameId);
  }
  if (roomId) {
    endpoint.searchParams.set("roomId", roomId);
  }
  endpoint.searchParams.set("role", "host");

  const response = await fetch(endpoint, {
    method: "GET",
  });
  if (!response.ok) {
    throw new Error(
      `Failed to read live harness sessions (${response.status}).`,
    );
  }

  const payload = (await response.json()) as DevHarnessSessionsResponse;
  return payload.sessions.map(mapRegisteredHarnessSession);
};

const resolveRegisteredHarnessCandidate = ({
  sessions,
  roomId,
  sessionId,
}: {
  sessions: AirJamHarnessSessionRecord[];
  roomId?: string;
  sessionId?: string;
}): AirJamHarnessSessionRecord | null => {
  if (sessionId) {
    return sessions.find((entry) => entry.sessionId === sessionId) ?? null;
  }

  if (roomId) {
    return sessions.find((entry) => entry.roomId === roomId) ?? null;
  }

  return sessions.length === 1 ? sessions[0] : null;
};

export const listVisualScenarios = async ({
  cwd = process.cwd(),
  gameId,
}: ListVisualScenariosOptions = {}): Promise<AirJamVisualScenarioList> => {
  const game = await inspectGame({ cwd, gameId });
  const source = await resolveVisualSource({ configPath: game.configPath });
  if (!source) {
    throw new Error(
      `No visual harness published for "${game.id}" in ${game.rootDir}.`,
    );
  }

  const helperResult = runTsxHelper<{
    hasVisualHarness?: boolean;
    gameId: string;
    bridgeActions: string[];
    actionMetadata: AirJamVisualScenarioList["actionMetadata"];
    hasBridgeActions: boolean;
    scenarios: AirJamVisualScenarioList["scenarios"];
  }>({
    helperFile: resolveHelperScriptPath("list-visual-scenarios.ts"),
    cwd: game.rootDir,
    args: [`--config=${source.configPath}`],
  });

  return {
    gameId: helperResult.gameId,
    scenarioModulePath: source.scenarioModulePath,
    hasBridgeActions: helperResult.hasBridgeActions,
    bridgeActions: helperResult.bridgeActions,
    actionMetadata: helperResult.actionMetadata,
    scenarios: helperResult.scenarios,
  };
};

const withHarnessSession = async <T>({
  cwd = process.cwd(),
  gameId,
  mode = "standalone-dev",
  secure = false,
  run,
}: {
  cwd?: string;
  gameId?: string;
  mode?: "standalone-dev" | "arcade-dev" | "arcade-test";
  secure?: boolean;
  run: (input: {
    game: Awaited<ReturnType<typeof inspectGame>>;
    visualSource: ResolvedVisualSource;
    started: Awaited<ReturnType<typeof startDev>>;
  }) => Promise<T>;
}): Promise<T> => {
  const game = await inspectGame({ cwd, gameId });
  const visualSource = await resolveVisualSource({
    configPath: game.configPath,
  });
  if (!visualSource) {
    throw new Error(
      `No visual harness published for "${game.id}" in ${game.rootDir}.`,
    );
  }

  const started = await startDev({
    cwd,
    gameId: game.id,
    mode,
    secure,
  });

  try {
    return await run({
      game,
      visualSource,
      started,
    });
  } finally {
    if (!started.reusedExistingProcess) {
      await stopDev({
        cwd,
        processId: started.process.id,
      });
    }
  }
};

const runHarnessSessionHelper = <T>({
  operation,
  configPath,
  scenarioModulePath,
  topology,
  timeoutMs,
  actionName,
  payload,
  roomId,
  cwd,
}: {
  operation: "read" | "invoke";
  configPath?: string | null;
  scenarioModulePath?: string | null;
  topology: Awaited<ReturnType<typeof getTopology>>;
  timeoutMs?: number;
  actionName?: string;
  payload?: unknown;
  roomId?: string;
  cwd: string;
}): T =>
  runTsxHelper<T>({
    helperFile: resolveHelperScriptPath("interact-harness.ts"),
    cwd,
    args: [
      `--operation=${operation}`,
      ...(configPath ? [`--config=${configPath}`] : []),
      ...(scenarioModulePath ? [`--module-path=${scenarioModulePath}`] : []),
      `--mode=${normalizeSessionMode(topology.topologyMode)}`,
      `--app-origin=${topology.urls.appOrigin}`,
      `--host-url=${withTargetRoomId({
        hostUrl: requireTopologyHostUrl(topology),
        roomId,
      })}`,
      `--controller-base-url=${topology.urls.controllerBaseUrl}`,
      `--public-host=${topology.urls.publicHost}`,
      ...(roomId ? [`--room-id=${roomId}`] : []),
      ...(topology.urls.localBuildUrl
        ? [`--local-build-url=${topology.urls.localBuildUrl}`]
        : []),
      ...(topology.urls.browserBuildUrl
        ? [`--browser-build-url=${topology.urls.browserBuildUrl}`]
        : []),
      ...(timeoutMs !== undefined ? [`--timeout-ms=${timeoutMs}`] : []),
      ...(actionName ? [`--action-name=${actionName}`] : []),
      ...(payload !== undefined
        ? [`--payload-json=${JSON.stringify(payload)}`]
        : []),
    ],
  });

export const listHarnessSessions = async ({
  cwd = process.cwd(),
  gameId,
  mode = "standalone-dev",
  secure = false,
  roomId,
}: ListHarnessSessionsOptions = {}): Promise<AirJamHarnessSessionList> =>
  withHarnessSession({
    cwd,
    gameId,
    mode,
    secure,
    run: async ({ game, started }) => {
      const sessions = await readRegisteredHarnessSessions({
        topology: started.topology,
        gameId: game.id,
        roomId: normalizeRoomId(roomId),
      });

      return {
        projectMode: started.topology.projectMode,
        mode,
        topologyMode: started.topology.topologyMode,
        secure,
        process: started.topology.process,
        sessions,
      };
    },
  });

export const readHarnessSnapshot = async ({
  cwd = process.cwd(),
  gameId,
  mode = "standalone-dev",
  secure = false,
  roomId,
  sessionId,
  timeoutMs = 10_000,
}: ReadHarnessSnapshotOptions = {}): Promise<AirJamHarnessSnapshotInspection> =>
  withHarnessSession({
    cwd,
    gameId,
    mode,
    secure,
    run: async ({ game, visualSource, started }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const sessions = await readRegisteredHarnessSessions({
        topology: started.topology,
        gameId: game.id,
        roomId: normalizedRoomId,
      }).catch(() => []);
      const registeredSession = resolveRegisteredHarnessCandidate({
        sessions,
        roomId: normalizedRoomId,
        sessionId,
      });
      if (registeredSession) {
        return {
          gameId: registeredSession.gameId,
          projectMode: started.topology.projectMode,
          mode,
          topologyMode: started.topology.topologyMode,
          secure,
          roomId: registeredSession.roomId,
          sessionId: registeredSession.sessionId,
          controlSurface: "registered-session" as const,
          process: started.topology.process,
          actions: registeredSession.actions,
          availableActions: registeredSession.availableActions,
          urls: {
            ...started.topology.urls,
            controllerJoinUrl:
              typeof registeredSession.snapshot?.controllerJoinUrl === "string"
                ? registeredSession.snapshot.controllerJoinUrl
                : null,
          },
          snapshot: registeredSession.snapshot,
        };
      }

      const helperResult = runHarnessSessionHelper<{
        gameId: string;
        actions: AirJamHarnessSnapshotInspection["actions"];
        availableActions: string[];
        roomId: string | null;
        controllerJoinUrl: string | null;
        snapshot: Record<string, unknown> | null;
      }>({
        operation: "read",
        configPath: visualSource.configPath,
        scenarioModulePath: visualSource.scenarioModulePath,
        topology: started.topology,
        roomId: normalizedRoomId,
        timeoutMs,
        cwd: game.rootDir,
      });

      return {
        gameId: helperResult.gameId,
        projectMode: started.topology.projectMode,
        mode,
        topologyMode: started.topology.topologyMode,
        secure,
        roomId: helperResult.roomId,
        sessionId: null,
        controlSurface: "isolated-session",
        process: started.topology.process,
        actions: helperResult.actions,
        availableActions: helperResult.availableActions,
        urls: {
          ...started.topology.urls,
          controllerJoinUrl: helperResult.controllerJoinUrl,
        },
        snapshot: helperResult.snapshot,
      };
    },
  });

export const invokeHarnessAction = async ({
  cwd = process.cwd(),
  gameId,
  mode = "standalone-dev",
  secure = false,
  roomId,
  sessionId,
  actionName,
  payload,
  timeoutMs = 10_000,
}: InvokeHarnessActionOptions): Promise<AirJamHarnessActionInvocation> =>
  withHarnessSession({
    cwd,
    gameId,
    mode,
    secure,
    run: async ({ game, visualSource, started }) => {
      const normalizedRoomId = normalizeRoomId(roomId);
      const sessions = await readRegisteredHarnessSessions({
        topology: started.topology,
        gameId: game.id,
        roomId: normalizedRoomId,
      }).catch(() => []);
      const registeredSession = resolveRegisteredHarnessCandidate({
        sessions,
        roomId: normalizedRoomId,
        sessionId,
      });
      if (registeredSession) {
        const response = await fetch(
          new URL(
            DEV_HARNESS_INVOKE_PATH,
            resolveHarnessServiceOrigin(started.topology),
          ),
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              sessionId: registeredSession.sessionId,
              roomId: registeredSession.roomId,
              gameId: game.id,
              actionName,
              payload,
              timeoutMs,
            }),
          },
        );
        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          throw new Error(
            errorPayload?.message ??
              `Failed to invoke live harness action (${response.status}).`,
          );
        }

        const result = (await response.json()) as DevHarnessInvokeResponse;
        const controllerJoinUrl =
          typeof result.session.snapshot?.controllerJoinUrl === "string"
            ? result.session.snapshot.controllerJoinUrl
            : null;

        return {
          gameId: result.session.gameId,
          projectMode: started.topology.projectMode,
          mode,
          topologyMode: started.topology.topologyMode,
          secure,
          roomId: result.session.roomId,
          sessionId: result.session.sessionId,
          controlSurface: "registered-session",
          process: started.topology.process,
          actions: mapRegisteredHarnessSession(result.session).actions,
          availableActions: [...result.session.actionNames],
          urls: {
            ...started.topology.urls,
            controllerJoinUrl,
          },
          actionName: result.invocation.actionName,
          payload: payload,
          result: result.invocation.result,
          snapshotBefore:
            result.invocation.snapshotBefore &&
            typeof result.invocation.snapshotBefore === "object"
              ? (result.invocation.snapshotBefore as Record<string, unknown>)
              : null,
          snapshotAfter:
            result.invocation.snapshotAfter &&
            typeof result.invocation.snapshotAfter === "object"
              ? (result.invocation.snapshotAfter as Record<string, unknown>)
              : null,
        };
      }

      const helperResult = runHarnessSessionHelper<{
        gameId: string;
        actions: AirJamHarnessActionInvocation["actions"];
        availableActions: string[];
        roomId: string | null;
        controllerJoinUrl: string | null;
        actionName: string;
        payload?: unknown;
        result: unknown;
        snapshotBefore: Record<string, unknown> | null;
        snapshotAfter: Record<string, unknown> | null;
      }>({
        operation: "invoke",
        configPath: visualSource.configPath,
        scenarioModulePath: visualSource.scenarioModulePath,
        topology: started.topology,
        roomId: normalizedRoomId,
        timeoutMs,
        actionName,
        payload,
        cwd: game.rootDir,
      });

      return {
        gameId: helperResult.gameId,
        projectMode: started.topology.projectMode,
        mode,
        topologyMode: started.topology.topologyMode,
        secure,
        roomId: helperResult.roomId,
        sessionId: null,
        controlSurface: "isolated-session",
        process: started.topology.process,
        actions: helperResult.actions,
        availableActions: helperResult.availableActions,
        urls: {
          ...started.topology.urls,
          controllerJoinUrl: helperResult.controllerJoinUrl,
        },
        actionName: helperResult.actionName,
        payload: helperResult.payload,
        result: helperResult.result,
        snapshotBefore: helperResult.snapshotBefore,
        snapshotAfter: helperResult.snapshotAfter,
      };
    },
  });

export const captureVisuals = async ({
  cwd = process.cwd(),
  gameId,
  scenarioId,
  mode = "standalone-dev",
  secure = false,
}: CaptureVisualsOptions = {}): Promise<CaptureVisualsResult> => {
  return withHarnessSession({
    cwd,
    gameId,
    mode,
    secure,
    run: async ({ game, visualSource, started }) => {
      const topology = started.topology;
      const artifactRoot = resolveVisualArtifactRoot(
        topology.process?.cwd ?? game.rootDir,
      );

      runTsxHelper<unknown>({
        helperFile: resolveHelperScriptPath("run-visual-capture.ts"),
        cwd: game.rootDir,
        args: [
          ...(visualSource.configPath
            ? [`--config=${visualSource.configPath}`]
            : []),
          ...(visualSource.scenarioModulePath
            ? [`--module-path=${visualSource.scenarioModulePath}`]
            : []),
          `--artifact-root=${artifactRoot}`,
          `--mode=${mode}`,
          `--app-origin=${topology.urls.appOrigin}`,
          `--host-url=${topology.urls.hostUrl}`,
          `--controller-base-url=${topology.urls.controllerBaseUrl}`,
          `--public-host=${topology.urls.publicHost}`,
          ...(topology.urls.localBuildUrl
            ? [`--local-build-url=${topology.urls.localBuildUrl}`]
            : []),
          ...(topology.urls.browserBuildUrl
            ? [`--browser-build-url=${topology.urls.browserBuildUrl}`]
            : []),
          ...(scenarioId ? [`--scenario-id=${scenarioId}`] : []),
          ...(secure ? ["--secure"] : []),
        ],
      });

      const inspection = await readVisualCaptureSummary({
        cwd,
        gameId: game.id,
      });

      return {
        gameId: inspection.gameId,
        artifactRoot,
        summaryPath: inspection.summaryPath,
        summary: inspection.summary,
        scenarios: await readScenarioMetadata({
          artifactRoot,
          summary: inspection.summary,
        }),
      };
    },
  });
};
