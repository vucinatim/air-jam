import { randomUUID } from "node:crypto";
import {
  inspectGameAgentContract,
  invokeGameAction,
  readGameSnapshot,
} from "./agent.js";
import {
  connectController,
  disconnectController,
  readRuntimeSnapshot,
  sendControllerInput,
} from "./controller.js";
import { getTopology } from "./dev.js";
import type {
  AirJamGameAgentActionDescriptor,
  AirJamGameSessionActionDescriptor,
  AirJamGameSessionInspection,
  AirJamGameSessionSummary,
  AirJamHarnessSnapshotInspection,
  CloseGameSessionOptions,
  CloseGameSessionResult,
  InvokeGameSessionActionOptions,
  InvokeGameSessionActionResult,
  OpenGameSessionOptions,
  ReadGameSessionOptions,
  SendGameSessionInputOptions,
  SendGameSessionInputResult,
} from "./types.js";
import { invokeHarnessAction, readHarnessSnapshot } from "./visual.js";

type InternalGameSession = {
  summary: AirJamGameSessionSummary;
  lookup: {
    cwd: string;
    gameId?: string;
    mode?: OpenGameSessionOptions["mode"];
    secure: boolean;
    roomId: string;
    harnessSessionId?: string;
  };
  actionRegistry: Map<
    string,
    | {
        lane: "player";
        kind: "game";
        actionId: string;
      }
    | {
        lane: "host";
        kind: "harness";
        actionName: string;
      }
  >;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const gameSessions = new Map<string, InternalGameSession>();

const toPlayerSessionActionId = (actionId: string): string => `player:${actionId}`;

const toHostSessionActionId = (actionName: string): string => `host:${actionName}`;

const describePlayerSessionActions = (
  gameActions: AirJamGameAgentActionDescriptor[],
): AirJamGameSessionActionDescriptor[] =>
  gameActions.map((action) => ({
    actionId: toPlayerSessionActionId(action.actionId),
    lane: "player" as const,
    source: "semantic-game" as const,
    description: action.description,
    availability: action.availability,
    payload: {
      kind: action.payload.kind,
      description: action.payload.description,
      ...(action.payload.allowedValues
        ? { allowedValues: [...action.payload.allowedValues] }
        : {}),
    },
    resultDescription: action.resultDescription,
  }));

const describeHostSessionActions = (
  harnessActions: AirJamHarnessSnapshotInspection["actions"],
): AirJamGameSessionActionDescriptor[] =>
  harnessActions.map((action) => ({
    actionId: toHostSessionActionId(action.name),
    lane: "host" as const,
    source: "visual-harness" as const,
    description: action.description,
    availability: null,
    payload: {
      kind: action.payload.kind,
      description: action.payload.description,
      ...(action.payload.allowedValues
        ? { allowedValues: [...action.payload.allowedValues] }
        : {}),
    },
    resultDescription: action.resultDescription,
  }));

const buildActionRegistryFromSessionActions = (
  actions: AirJamGameSessionActionDescriptor[],
): InternalGameSession["actionRegistry"] => {
  const registry = new Map<
    string,
    InternalGameSession["actionRegistry"] extends Map<string, infer T> ? T : never
  >();
  for (const action of actions) {
    if (action.lane === "player") {
      registry.set(action.actionId, {
        lane: "player",
        kind: "game",
        actionId: action.actionId.slice("player:".length),
      });
      continue;
    }

    registry.set(action.actionId, {
      lane: "host",
      kind: "harness",
      actionName: action.actionId.slice("host:".length),
    });
  }
  return registry;
};

const getRequiredGameSession = (gameSessionId: string): InternalGameSession => {
  const session = gameSessions.get(gameSessionId);
  if (!session) {
    throw new Error(
      `Unknown Air Jam game session "${gameSessionId}". Open a game session first.`,
    );
  }

  return session;
};

const toSummary = (
  session: InternalGameSession,
  overrides?: Partial<AirJamGameSessionSummary>,
): AirJamGameSessionSummary => ({
  ...session.summary,
  ...overrides,
});

const buildSyntheticHarnessSnapshot = async ({
  session,
  gameId,
  runtimeHarnessSnapshot,
}: {
  session: InternalGameSession;
  gameId: string;
  runtimeHarnessSnapshot: Record<string, unknown>;
}): Promise<AirJamHarnessSnapshotInspection> => {
  const topology = await getTopology({
    cwd: session.lookup.cwd,
    gameId: session.lookup.gameId,
    mode: session.lookup.mode,
    secure: session.lookup.secure,
  });

  return {
    gameId,
    projectMode: topology.projectMode,
    mode: topology.mode,
    topologyMode: topology.topologyMode,
    secure: topology.secure,
    roomId: session.summary.roomId,
    sessionId: null,
    controlSurface: session.summary.harnessControlSurface ?? "isolated-session",
    process: topology.process,
    actions: [],
    availableActions: [],
    urls: {
      ...topology.urls,
      controllerJoinUrl: session.summary.controllerJoinUrl,
    },
    snapshot: runtimeHarnessSnapshot,
  };
};

const readRegisteredHarnessSnapshotIfAvailable = async ({
  session,
  timeoutMs,
}: {
  session: InternalGameSession;
  timeoutMs: number;
}): Promise<AirJamHarnessSnapshotInspection | null> => {
  if (!session.summary.hasHarnessBridge) {
    return null;
  }

  try {
    return await readHarnessSnapshot({
      cwd: session.lookup.cwd,
      gameId: session.lookup.gameId,
      mode: session.lookup.mode,
      secure: session.lookup.secure,
      roomId: session.lookup.roomId,
      sessionId: session.lookup.harnessSessionId,
      timeoutMs,
    });
  } catch {
    return null;
  }
};

const buildOpenSummary = async ({
  options,
  controllerSession,
}: {
  options: OpenGameSessionOptions;
  controllerSession: Awaited<ReturnType<typeof connectController>>;
}): Promise<AirJamGameSessionSummary> => {
  const resolvedGameId = controllerSession.gameId ?? options.gameId ?? null;
  const agentContract =
    resolvedGameId !== null
      ? await inspectGameAgentContract({
          cwd: options.cwd,
          gameId: resolvedGameId,
        }).catch(() => null)
      : null;
  const harnessSnapshot =
    resolvedGameId !== null && options.harnessSessionId
      ? await readHarnessSnapshot({
          cwd: options.cwd,
          gameId: resolvedGameId,
          mode: options.mode,
          secure: options.secure,
          roomId: controllerSession.roomId,
          sessionId: options.harnessSessionId,
          timeoutMs: options.timeoutMs,
        }).catch(() => null)
      : null;

  const gameActions = agentContract?.actions ?? [];
  const harnessActions = harnessSnapshot?.actions ?? [];
  const actions = [
    ...describePlayerSessionActions(gameActions),
    ...describeHostSessionActions(harnessActions),
  ];

  return {
    gameSessionId: randomUUID(),
    cwd: options.cwd ?? process.cwd(),
    gameId: resolvedGameId,
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
    harnessSessionId: harnessSnapshot?.sessionId ?? options.harnessSessionId ?? null,
    harnessControlSurface:
      harnessSnapshot?.controlSurface ??
      (controllerSession.harnessSnapshot ? "isolated-session" : null),
    hasHarnessBridge: Boolean(harnessSnapshot ?? controllerSession.harnessSnapshot),
    hasAgentContract: Boolean(agentContract?.hasContract),
    actions,
  };
};

export const openGameSession = async (
  options: OpenGameSessionOptions = {},
): Promise<AirJamGameSessionSummary> => {
  const controllerSession = await connectController(options);
  const summary = await buildOpenSummary({
    options,
    controllerSession,
  });

  gameSessions.set(summary.gameSessionId, {
    summary,
    lookup: {
      cwd: summary.cwd,
      ...(summary.gameId ? { gameId: summary.gameId } : {}),
      ...(summary.mode ? { mode: summary.mode } : {}),
      secure: summary.secure,
      roomId: summary.roomId,
      ...(summary.harnessSessionId
        ? { harnessSessionId: summary.harnessSessionId }
        : {}),
    },
    actionRegistry: buildActionRegistryFromSessionActions(summary.actions),
  });

  return summary;
};

export const readGameSession = async ({
  gameSessionId,
  requestSync = true,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ReadGameSessionOptions): Promise<AirJamGameSessionInspection> => {
  const session = getRequiredGameSession(gameSessionId);
  const runtimeSnapshot = await readRuntimeSnapshot({
    controllerSessionId: session.summary.controllerSessionId,
    requestSync: false,
  });
  const gameSnapshot = session.summary.hasAgentContract
    ? await readGameSnapshot({
        controllerSessionId: session.summary.controllerSessionId,
        requestSync,
        timeoutMs,
      })
    : null;
  const registeredHarnessSnapshot = await readRegisteredHarnessSnapshotIfAvailable(
    {
      session,
      timeoutMs,
    },
  );
  const harnessSnapshot =
    registeredHarnessSnapshot ??
    (runtimeSnapshot.harnessSnapshot && session.summary.gameId
      ? await buildSyntheticHarnessSnapshot({
          session,
          gameId: session.summary.gameId,
          runtimeHarnessSnapshot: runtimeSnapshot.harnessSnapshot,
        })
      : null);

  const nextGameActions = gameSnapshot?.actions ?? [];
  const nextHarnessActions = harnessSnapshot?.actions ?? [];
  const nextActions = [
    ...describePlayerSessionActions(nextGameActions),
    ...describeHostSessionActions(nextHarnessActions),
  ];
  session.summary = toSummary(session, {
    connected: runtimeSnapshot.connected,
    disconnectedAt: runtimeSnapshot.disconnectedAt,
    disconnectReason: runtimeSnapshot.disconnectReason,
    process: runtimeSnapshot.process,
    harnessSessionId:
      harnessSnapshot?.sessionId ?? session.summary.harnessSessionId,
    harnessControlSurface:
      harnessSnapshot?.controlSurface ?? session.summary.harnessControlSurface,
    hasHarnessBridge:
      session.summary.hasHarnessBridge || Boolean(harnessSnapshot),
    actions: nextActions,
  });
  session.actionRegistry = buildActionRegistryFromSessionActions(nextActions);

  return {
    ...session.summary,
    runtimeSnapshot,
    gameSnapshot,
    harnessSnapshot,
  };
};

export const sendGameSessionInput = async ({
  gameSessionId,
  input,
}: SendGameSessionInputOptions): Promise<SendGameSessionInputResult> => {
  const session = getRequiredGameSession(gameSessionId);
  const sent = await sendControllerInput({
    controllerSessionId: session.summary.controllerSessionId,
    input,
  });

  session.summary = toSummary(session, {
    connected: sent.connected,
    disconnectedAt: sent.disconnectedAt,
    disconnectReason: sent.disconnectReason,
    process: sent.process,
  });

  return {
    ...session.summary,
    input: sent.input,
    sentAt: sent.sentAt,
  };
};

export const invokeGameSessionAction = async (
  options: InvokeGameSessionActionOptions,
): Promise<InvokeGameSessionActionResult> => {
  const session = getRequiredGameSession(options.gameSessionId);
  const resolvedAction = session.actionRegistry.get(options.actionId);
  if (!resolvedAction) {
    throw new Error(
      `Unknown game session action "${options.actionId}" for session "${options.gameSessionId}".`,
    );
  }

  if (resolvedAction.kind === "game") {
    const invocation = await invokeGameAction({
      controllerSessionId: session.summary.controllerSessionId,
      actionId: resolvedAction.actionId,
      payload: options.payload,
    });

    return {
      ...session.summary,
      actionId: options.actionId,
      lane: "player",
      invocation,
    };
  }
  if (!session.summary.hasHarnessBridge) {
    throw new Error(
      `Game session "${options.gameSessionId}" does not have a host action surface available.`,
    );
  }

  const invocation = await invokeHarnessAction({
    cwd: session.lookup.cwd,
    gameId: session.lookup.gameId,
    mode: session.lookup.mode,
    secure: session.lookup.secure,
    roomId: session.lookup.roomId,
    sessionId: session.lookup.harnessSessionId,
    actionName: resolvedAction.actionName,
    payload: options.payload,
    timeoutMs: options.timeoutMs,
  });
  const nextActions = [
    ...session.summary.actions.filter((action) => action.source === "semantic-game"),
    ...describeHostSessionActions(invocation.actions),
  ];

  session.summary = toSummary(session, {
    harnessSessionId: invocation.sessionId ?? session.summary.harnessSessionId,
    harnessControlSurface: invocation.controlSurface,
    hasHarnessBridge: true,
    actions: nextActions,
  });
  session.actionRegistry = buildActionRegistryFromSessionActions(nextActions);

  return {
    ...session.summary,
    actionId: options.actionId,
    lane: "host",
    invocation,
  };
};

export const closeGameSession = async ({
  gameSessionId,
}: CloseGameSessionOptions): Promise<CloseGameSessionResult> => {
  const session = getRequiredGameSession(gameSessionId);
  const disconnected = await disconnectController({
    controllerSessionId: session.summary.controllerSessionId,
  });

  session.summary = toSummary(session, {
    connected: disconnected.session.connected,
    disconnectedAt: disconnected.session.disconnectedAt,
    disconnectReason: disconnected.session.disconnectReason,
    process: disconnected.session.process,
  });
  gameSessions.delete(gameSessionId);

  return {
    closed: true,
    session: session.summary,
  };
};
