import type {
  HostAgentRequest,
  HostAgentResponse,
} from "@air-jam/sdk/runtime-control";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  captureControllerSessionVisuals,
  connectController,
  disconnectController,
  invokeControllerAction,
  ownsControllerSessionHost,
  readRuntimeSnapshot,
  requestControllerHostAgent,
  resolveControllerSessionGameRuntime,
  sendControllerInput,
} from "./controller.js";
import { startDev, stopDev } from "./dev.js";
import {
  classifyGameActionOutcome,
  computeGameSnapshotObservation,
} from "./game-action-observation.js";
import { GameSessionOperations } from "./game-session-operations.js";
import type { VisualHarnessPageSurface } from "./harness/visual.js";
import { evaluateOwnedGameContract } from "./tooling/runtime-owner-actions.js";
import type {
  AirJamGameAgentActionDescriptor,
  AirJamGameSessionActionDescriptor,
  AirJamGameSessionInspection,
  AirJamGameSessionSummary,
  AirJamGameSessionVisualCaptureResult,
  CaptureGameSessionVisualsOptions,
  CloseGameSessionOptions,
  CloseGameSessionResult,
  InvokeGameSessionActionOptions,
  InvokeGameSessionActionResult,
  OpenGameSessionOptions,
  ReadGameSessionOptions,
  SendGameSessionInputOptions,
  SendGameSessionInputResult,
} from "./types.js";

export type {
  AirJamGameSessionActionDescriptor,
  AirJamGameSessionInspection,
  AirJamGameSessionSummary,
  AirJamGameSessionVisualCaptureResult,
  CaptureGameSessionVisualsOptions,
  CloseGameSessionOptions,
  CloseGameSessionResult,
  InvokeGameSessionActionOptions,
  InvokeGameSessionActionResult,
  OpenGameSessionOptions,
  ReadGameSessionOptions,
  SendGameSessionInputOptions,
  SendGameSessionInputResult,
} from "./types.js";

type InternalGameSession = {
  summary: AirJamGameSessionSummary;
  operations: GameSessionOperations;
  devProcessId: string | null;
  requestHost: (
    request: HostAgentRequest,
    timeoutMs: number,
    signal?: AbortSignal,
  ) => Promise<HostAgentResponse>;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_SESSION_OPEN_TIMEOUT_MS = 30_000;
const gameSessions = new Map<string, InternalGameSession>();
const devProcessLeases = new Map<
  string,
  { cwd: string; referenceCount: number; stopOnZero: boolean }
>();

const acquireDevProcessLease = async (
  options: OpenGameSessionOptions,
): Promise<string | null> => {
  // Explicit targets belong to an already running host. Attaching must never
  // start, replace, or later stop that host's development processes.
  if (options.controllerJoinUrl || options.roomId?.trim()) {
    return null;
  }
  const started = await startDev({
    cwd: options.cwd,
    gameId: options.gameId,
    mode: options.mode,
    secure: options.secure,
  });
  const processId = started.process.id;
  const existing = devProcessLeases.get(processId);
  devProcessLeases.set(processId, {
    cwd: started.process.cwd,
    referenceCount: (existing?.referenceCount ?? 0) + 1,
    stopOnZero: existing?.stopOnZero ?? !started.reusedExistingProcess,
  });
  return processId;
};

const releaseDevProcessLease = async (processId: string): Promise<void> => {
  const lease = devProcessLeases.get(processId);
  if (!lease) {
    return;
  }
  if (lease.referenceCount > 1) {
    devProcessLeases.set(processId, {
      ...lease,
      referenceCount: lease.referenceCount - 1,
    });
    return;
  }

  devProcessLeases.delete(processId);
  if (lease.stopOnZero) {
    await stopDev({ cwd: lease.cwd, processId });
  }
};

const toSessionActionId = (lane: "player" | "host", actionId: string): string =>
  `${lane}:${actionId}`;

const describeSessionActions = (
  actions: AirJamGameAgentActionDescriptor[],
  ownsHost: boolean,
): AirJamGameSessionActionDescriptor[] =>
  actions.map((action) => ({
    actionId: toSessionActionId(
      action.target.kind === "host" ? "host" : "player",
      action.actionId,
    ),
    lane: action.target.kind === "host" ? "host" : "player",
    source: "semantic-game",
    description: action.description,
    availability:
      action.target.kind === "host" && !ownsHost
        ? "host_runtime_not_owned: Host actions require an owned host runtime."
        : action.availability,
    payload: {
      kind: action.payload.kind,
      description: action.payload.description,
      ...(action.payload.allowedValues
        ? { allowedValues: [...action.payload.allowedValues] }
        : {}),
    },
    resultDescription: action.resultDescription,
  }));

const getRequiredGameSession = (gameSessionId: string): InternalGameSession => {
  const session = gameSessions.get(gameSessionId);
  if (!session) {
    throw new Error(
      `Unknown Air Jam game session "${gameSessionId}". Open a game session first.`,
    );
  }
  return session;
};

const updateSummary = (
  session: InternalGameSession,
  overrides: Partial<AirJamGameSessionSummary>,
): void => {
  session.summary = { ...session.summary, ...overrides };
};

export const openGameSession = async (
  options: OpenGameSessionOptions = {},
  ownedHost?: VisualHarnessPageSurface,
): Promise<AirJamGameSessionSummary> => {
  const devProcessId = await acquireDevProcessLease(options);
  const timeoutMs = options.timeoutMs ?? DEFAULT_SESSION_OPEN_TIMEOUT_MS;
  let controllerSession: Awaited<ReturnType<typeof connectController>>;
  try {
    controllerSession = await connectController({ ...options, timeoutMs });
  } catch (error) {
    if (devProcessId) {
      await releaseDevProcessLease(devProcessId).catch(() => undefined);
    }
    throw error;
  }
  const operations = new GameSessionOperations();
  try {
    const runtime = await resolveControllerSessionGameRuntime({
      controllerSessionId: controllerSession.controllerSessionId,
      timeoutMs,
    });
    const gameId =
      runtime.gameId ?? controllerSession.gameId ?? options.gameId ?? null;
    const ownsHost =
      !!ownedHost ||
      ownsControllerSessionHost(controllerSession.controllerSessionId);
    const requestHost = ownedHost
      ? (request: HostAgentRequest) =>
          evaluateOwnedGameContract(ownedHost, request)
      : (request: HostAgentRequest, timeoutMs: number, signal?: AbortSignal) =>
          requestControllerHostAgent(
            controllerSession.controllerSessionId,
            request,
            timeoutMs,
            signal,
          );
    const live = ownsHost
      ? await operations.run(timeoutMs, (signal) =>
          requestHost(
            {
              operation: "read",
              roomId: controllerSession.roomId,
              controllerId: controllerSession.controllerId,
            },
            timeoutMs,
            signal,
          ),
        )
      : null;
    const contract = live?.operation === "read" ? live.snapshot : null;
    const gameActions = contract?.actions ?? [];
    const summary: AirJamGameSessionSummary = {
      semanticAccess: ownsHost ? "owned-host" : "participant-only",
      gameSessionId: randomUUID(),
      cwd: options.cwd ?? process.cwd(),
      gameId,
      controllerSessionId: controllerSession.controllerSessionId,
      projectMode: controllerSession.projectMode,
      mode: controllerSession.mode,
      topologyMode: controllerSession.topologyMode,
      secure: controllerSession.secure,
      process: controllerSession.process,
      roomId: controllerSession.roomId,
      controllerId: controllerSession.controllerId,
      deviceId: controllerSession.deviceId,
      controllerJoinUrl: controllerSession.controllerJoinUrl,
      socketOrigin: controllerSession.socketOrigin,
      connected: controllerSession.connected,
      connectedAt: controllerSession.connectedAt,
      disconnectedAt: controllerSession.disconnectedAt,
      disconnectReason: controllerSession.disconnectReason,
      hasAgentContract: Boolean(contract),
      actions: describeSessionActions(gameActions, ownsHost),
    };

    gameSessions.set(summary.gameSessionId, {
      summary,
      operations,
      requestHost,
      devProcessId,
    });
    return summary;
  } catch (error) {
    operations.close();
    await disconnectController({
      controllerSessionId: controllerSession.controllerSessionId,
    }).catch(() => undefined);
    if (devProcessId) {
      await releaseDevProcessLease(devProcessId).catch(() => undefined);
    }
    throw error;
  }
};

async function readLiveSnapshot(
  session: InternalGameSession,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<import("./types.js").AirJamGameSnapshotInspection | null> {
  const response = await session.requestHost(
    {
      operation: "read",
      roomId: session.summary.roomId,
      controllerId: session.summary.controllerId,
    },
    timeoutMs,
    signal,
  );
  if (response.operation !== "read")
    throw new Error("Invalid host read response.");
  const value = response.snapshot;
  updateSummary(session, {
    hasAgentContract: !!value,
    actions: describeSessionActions(value?.actions ?? [], true),
  });
  if (!value) return null;
  if (!session.summary.gameId)
    throw new Error("Owned game session has no game identity.");
  return {
    ...value,
    controllerSessionId: session.summary.controllerSessionId,
    gameId: session.summary.gameId,
    runtimeStoreDomains: value.rawStores.map((store) => store.storeDomain),
  };
}

export const readGameSession = async ({
  gameSessionId,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ReadGameSessionOptions): Promise<AirJamGameSessionInspection> => {
  const session = getRequiredGameSession(gameSessionId);
  return session.operations.run(timeoutMs, async (signal) => {
    const gameSnapshot = await readLiveSnapshot(session, timeoutMs, signal);
    const runtimeSnapshot = await readRuntimeSnapshot({
      controllerSessionId: session.summary.controllerSessionId,
      requestSync: false,
    });
    updateSummary(session, {
      connected: runtimeSnapshot.connected,
      disconnectedAt: runtimeSnapshot.disconnectedAt,
      disconnectReason: runtimeSnapshot.disconnectReason,
      process: runtimeSnapshot.process,
    });
    return { ...session.summary, runtimeSnapshot, gameSnapshot };
  });
};

export const sendGameSessionInput = async ({
  gameSessionId,
  input,
}: SendGameSessionInputOptions): Promise<SendGameSessionInputResult> => {
  const session = getRequiredGameSession(gameSessionId);
  return session.operations.run(DEFAULT_TIMEOUT_MS, async () => {
    const sent = await sendControllerInput({
      controllerSessionId: session.summary.controllerSessionId,
      input,
    });
    updateSummary(session, {
      connected: sent.connected,
      disconnectedAt: sent.disconnectedAt,
      disconnectReason: sent.disconnectReason,
      process: sent.process,
    });
    return { ...session.summary, input: sent.input, sentAt: sent.sentAt };
  });
};

export const invokeGameSessionAction = async (
  options: InvokeGameSessionActionOptions,
): Promise<InvokeGameSessionActionResult> => {
  const session = getRequiredGameSession(options.gameSessionId);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  return session.operations.run(timeoutMs, async (signal) => {
    const before = await readLiveSnapshot(session, timeoutMs, signal);
    if (!before)
      throw new Error(
        "contract_runtime_unavailable: Game has no live semantic contract.",
      );
    const action = before.actions.find(
      (action) =>
        toSessionActionId(
          action.target.kind === "host" ? "host" : "player",
          action.actionId,
        ) === options.actionId,
    );
    if (!action)
      throw new Error(`Unknown game session action "${options.actionId}".`);
    const resolved = await session.requestHost(
      {
        operation: action.target.kind === "host" ? "invoke-host" : "resolve",
        roomId: session.summary.roomId,
        controllerId: session.summary.controllerId,
        contractId: before.contractId,
        runtimeId: before.runtimeId,
        actionId: action.actionId,
        payload: options.payload,
      },
      timeoutMs,
      signal,
    );
    if (resolved.operation === "read")
      throw new Error("Invalid host resolve response.");
    const lane = resolved.target.kind === "host" ? "host" : "player";
    const sentAt = new Date().toISOString();
    const sent =
      lane === "player"
        ? await invokeControllerAction({
            controllerSessionId: session.summary.controllerSessionId,
            actionName: resolved.target.actionName,
            storeDomain: resolved.target.storeDomain,
            payload: resolved.payload,
            timeoutMs,
          })
        : null;
    const acknowledgement = sent?.acknowledgement ?? resolved.acknowledgement;
    if (!acknowledgement)
      throw new Error("Host action returned no acknowledgement.");
    const after = await readLiveSnapshot(session, timeoutMs, signal);
    if (!after)
      throw new Error(
        "contract_changed: Game contract unmounted after invocation; action may have executed.",
      );
    const observation = computeGameSnapshotObservation({
      snapshotBefore: before,
      snapshotAfter: after,
    });
    const classified = classifyGameActionOutcome({
      acknowledgement,
      observedStateChange: observation.observedStateChange,
    });
    const outcome =
      observation.snapshotAfterStatus === "contract_changed" ||
      observation.snapshotAfterStatus === "runtime_replaced"
        ? observation.snapshotAfterStatus
        : classified.outcome;
    return {
      ...session.summary,
      actionId: options.actionId,
      lane,
      invocation: {
        ...session.summary,
        actionId: action.actionId,
        lane,
        actionName: resolved.target.actionName,
        storeDomain: resolved.target.storeDomain,
        payload: resolved.payload,
        sentAt,
        acknowledgement,
        ...classified,
        outcome,
        ...observation,
        snapshotBefore: before,
        snapshotAfter: after,
      },
    };
  });
};

export const captureGameSessionVisuals = async ({
  gameSessionId,
  timeoutMs,
}: CaptureGameSessionVisualsOptions): Promise<AirJamGameSessionVisualCaptureResult> => {
  const session = getRequiredGameSession(gameSessionId);
  return session.operations.run(timeoutMs ?? 30000, async () => {
    const captureId = `${new Date()
      .toISOString()
      .replaceAll(/[^0-9A-Za-z]/gu, "-")}-${randomUUID().slice(0, 8)}`;
    const relativeDir = path.join(
      ".airjam",
      "artifacts",
      "session-visuals",
      gameSessionId,
      captureId,
    );
    const captured = await captureControllerSessionVisuals({
      controllerSessionId: session.summary.controllerSessionId,
      relativeDir,
      timeoutMs,
    });
    return {
      ...session.summary,
      contract: "air-jam-game-session-visual-capture/v1",
      capturedAt: captured.capturedAt,
      artifactDir: path.join(session.summary.cwd, relativeDir),
      screenshots: captured.screenshots.map((screenshot) => ({
        ...screenshot,
        filePath: path.join(session.summary.cwd, screenshot.relativePath),
      })),
    };
  });
};

export const closeGameSession = async ({
  gameSessionId,
}: CloseGameSessionOptions): Promise<CloseGameSessionResult> => {
  const session = getRequiredGameSession(gameSessionId);
  session.operations.close();
  const disconnected = await disconnectController({
    controllerSessionId: session.summary.controllerSessionId,
  });
  updateSummary(session, {
    connected: disconnected.session.connected,
    disconnectedAt: disconnected.session.disconnectedAt,
    disconnectReason: disconnected.session.disconnectReason,
    process: disconnected.session.process,
  });
  gameSessions.delete(gameSessionId);
  if (session.devProcessId) {
    await releaseDevProcessLease(session.devProcessId);
  }
  return { closed: true, session: session.summary };
};
