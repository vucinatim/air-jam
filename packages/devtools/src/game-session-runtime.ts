import { playerProfileSchema } from "@air-jam/sdk/protocol";
import type {
  HostAgentRequest,
  HostAgentResponse,
  HostObservationRequest,
} from "@air-jam/sdk/runtime-control";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { z } from "zod";
import {
  captureControllerSessionVisuals,
  connectController,
  controlControllerParticipant,
  disconnectController,
  forceDisconnectController,
  invokeControllerAction,
  ownsControllerSessionHost,
  readRuntimeSnapshot,
  requestControllerHostAgent,
  resolveControllerSessionGameRuntime,
  sendControllerInput,
  watchControllerSessionVisuals,
} from "./controller.js";
import { startDev, stopDev } from "./dev.js";
import {
  classifyGameActionOutcome,
  computeGameSnapshotObservation,
} from "./game-action-observation.js";
import type { PinnedGameBuild } from "./game-build-protocol.js";
import {
  wallClock,
  type GameRunParticipant,
  type GameRunSession,
} from "./game-run-owner.js";
import { GameSessionOperations } from "./game-session-operations.js";
import { gameSessionOperationSchemas } from "./game-session-protocol.js";
import type { HeadlessRoom } from "./headless-room.js";
import type { ProcessScopeObserver } from "./managed-process-scope.js";
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

/** Sends one semantic request to the game's host realm. */
export type HostRequester = (
  request: HostAgentRequest,
  timeoutMs: number,
  signal?: AbortSignal,
) => Promise<HostAgentResponse>;

type InternalGameSession = {
  summary: AirJamGameSessionSummary;
  operations: GameSessionOperations;
  devProcessId: string | null;
  disconnection?: Awaited<ReturnType<typeof disconnectController>>;
  requestHost: HostRequester;
};

export function createGameSessionRuntime(ownerInstanceId = randomUUID()) {
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

    if (lease.stopOnZero) {
      await stopDev({ cwd: lease.cwd, processId });
    }
    devProcessLeases.delete(processId);
  };

  const toSessionActionId = (
    lane: "player" | "host",
    actionId: string,
  ): string => `${lane}:${actionId}`;

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

  const getRequiredGameSession = (
    gameSessionId: string,
  ): InternalGameSession => {
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

  const openGameSession = async (
    options: OpenGameSessionOptions = {},
    /** A host realm this session reaches directly rather than through its controller. */
    host?: { access: "owned-host" | "delegated-host"; request: HostRequester },
    build?: PinnedGameBuild,
    onScope?: ProcessScopeObserver,
    settings?: Record<string, number | boolean | string>,
  ): Promise<AirJamGameSessionSummary> => {
    const devProcessId = build ? null : await acquireDevProcessLease(options);
    const timeoutMs = options.timeoutMs ?? DEFAULT_SESSION_OPEN_TIMEOUT_MS;
    let controllerSession: Awaited<ReturnType<typeof connectController>>;
    try {
      controllerSession = await connectController(
        { ...options, timeoutMs },
        { build, onScope, settings },
      );
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
        !!host ||
        ownsControllerSessionHost(controllerSession.controllerSessionId);
      const requestHost: HostRequester =
        host?.request ??
        ((request, timeoutMs, signal) =>
          requestControllerHostAgent(
            controllerSession.controllerSessionId,
            request,
            timeoutMs,
            signal,
          ));
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
        semanticAccess:
          host?.access ?? (ownsHost ? "owned-host" : "participant-only"),
        ownerInstanceId,
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

  const readGameSession = async ({
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

  const observeGameSession = async ({
    gameSessionId,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    scope = "diagnostic",
    includeImage = true,
    expected,
  }: ReadGameSessionOptions &
    Partial<
      Pick<HostObservationRequest, "scope" | "includeImage" | "expected">
    >) => {
    const session = getRequiredGameSession(gameSessionId);
    if (session.summary.semanticAccess === "participant-only")
      throw new Error(
        "contract_runtime_not_owned: Observation requires an owned host or an explicit observation delegation.",
      );
    return session.operations.run(timeoutMs, async (signal) => {
      const result = await session.requestHost(
        {
          operation: "observe",
          roomId: session.summary.roomId,
          controllerId: session.summary.controllerId,
          scope,
          includeImage,
          expected,
        },
        timeoutMs,
        signal,
      );
      if (result.operation !== "observe")
        throw new Error(
          "invalid_runtime_response: Expected a host observation.",
        );
      return result.observation;
    });
  };

  const gameSettings = async (
    options:
      | z.infer<(typeof gameSessionOperationSchemas)["settings-read"]>
      | z.infer<(typeof gameSessionOperationSchemas)["settings-update"]>,
  ) => {
    const session = getRequiredGameSession(options.gameSessionId);
    if (session.summary.semanticAccess === "participant-only")
      throw new Error(
        "contract_runtime_not_owned: Settings require an owned host.",
      );
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    return session.operations.run(timeoutMs, async (signal) => {
      const snapshot = await readLiveSnapshot(session, timeoutMs, signal);
      if (!snapshot)
        throw new Error(
          "contract_runtime_unavailable: Game has no live semantic contract.",
        );
      const request = {
        roomId: session.summary.roomId,
        runtimeId: snapshot.runtimeId,
      };
      const response = await session.requestHost(
        "patch" in options
          ? {
              ...request,
              operation: "settings-update",
              patch: options.patch,
              expectedRevision: options.expectedRevision,
            }
          : { ...request, operation: "settings-read" },
        timeoutMs,
        signal,
      );
      if (
        response.operation !== "settings-read" &&
        response.operation !== "settings-update"
      )
        throw new Error("invalid_runtime_response: Expected settings.");
      return { values: response.values, revision: response.revision };
    });
  };
  const readGameSettings = (
    options: z.infer<(typeof gameSessionOperationSchemas)["settings-read"]>,
  ) => gameSettings(options);
  const updateGameSettings = (
    options: z.infer<(typeof gameSessionOperationSchemas)["settings-update"]>,
  ) => gameSettings(options);

  const controlGameSessionParticipant = async (
    options: z.infer<typeof gameSessionOperationSchemas.control>,
  ) => {
    const session = getRequiredGameSession(options.gameSessionId);
    return session.operations.run(DEFAULT_TIMEOUT_MS, () =>
      controlControllerParticipant({
        controllerSessionId: session.summary.controllerSessionId,
        expected: options.expected,
        lease: options.lease,
        operation: options.operation,
      }),
    );
  };

  const sendGameSessionInput = async ({
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

  const invokeGameSessionAction = async (
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
      if (
        resolved.operation !== "resolve" &&
        resolved.operation !== "invoke-host"
      )
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

  const captureGameSessionVisuals = async ({
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

  const disposeGameSession = async (
    { gameSessionId }: CloseGameSessionOptions,
    disconnect: typeof disconnectController,
  ): Promise<CloseGameSessionResult> => {
    const session = getRequiredGameSession(gameSessionId);
    session.operations.close();
    const disconnected = (session.disconnection ??= await disconnect({
      controllerSessionId: session.summary.controllerSessionId,
    }));
    updateSummary(session, {
      connected: disconnected.session.connected,
      disconnectedAt: disconnected.session.disconnectedAt,
      disconnectReason: disconnected.session.disconnectReason,
      process: disconnected.session.process,
    });
    if (session.devProcessId) {
      await releaseDevProcessLease(session.devProcessId);
      session.devProcessId = null;
    }
    gameSessions.delete(gameSessionId);
    return {
      closed: true,
      session: session.summary,
      disconnection: {
        release: disconnected.release,
        leave: disconnected.leave,
      },
    };
  };
  const closeGameSession = (input: CloseGameSessionOptions) =>
    disposeGameSession(input, disconnectController);

  return {
    openGameSession,
    readGameSession,
    observeGameSession,
    readGameSettings,
    updateGameSettings,
    sendGameSessionInput,
    controlGameSessionParticipant,
    invokeGameSessionAction,
    captureGameSessionVisuals,
    closeGameSession,
    async openRunSession(
      options: OpenGameSessionOptions,
      {
        delegation,
        build,
        room,
        settings,
        onScope,
      }: {
        /** The creator's host and the further seat identities its editor issued. */
        delegation?: { host: HostRequester; seatControllerIds: string[] };
        build?: PinnedGameBuild;
        /** A headless room this run owns; its players join it on game time. */
        room?: HeadlessRoom;
        settings?: Record<string, number | boolean | string>;
        onScope?: ProcessScopeObserver;
      } = {},
    ): Promise<GameRunSession> {
      if (room && (delegation || build || options.controllerJoinUrl))
        throw new Error(
          "A headless room is its own target; it takes no build or other room.",
        );
      const summary = await openGameSession(
        room
          ? { ...options, controllerJoinUrl: room.controllerJoinUrl }
          : options,
        room
          ? { access: "owned-host", request: room.requestHost }
          : delegation && {
              access: "delegated-host",
              request: delegation.host,
            },
        build,
        onScope,
        room ? undefined : settings,
      );
      const seatControllerIds = [...(delegation?.seatControllerIds ?? [])];
      const gameSessionId = summary.gameSessionId;
      const session = getRequiredGameSession(gameSessionId);
      const checkParticipant = async (
        controllerSessionId: string,
        controllerId: string,
      ) => {
        const state = await readRuntimeSnapshot({
          controllerSessionId,
          requestSync: false,
        });
        if (!state.connected || state.controllerId !== controllerId)
          throw new Error(
            "seat_replaced: Run participant is no longer connected.",
          );
      };
      const observeParticipant =
        (
          controllerSessionId: string,
          controllerId: string,
        ): GameRunParticipant["observe"] =>
        (input) =>
          session.operations.run(DEFAULT_TIMEOUT_MS, async (signal) => {
            await checkParticipant(controllerSessionId, controllerId);
            const result = await session.requestHost(
              {
                operation: "observe",
                roomId: summary.roomId,
                controllerId,
                ...input,
              },
              DEFAULT_TIMEOUT_MS,
              signal,
            );
            if (result.operation !== "observe")
              throw new Error(
                "invalid_runtime_response: Expected a host observation.",
              );
            await checkParticipant(controllerSessionId, controllerId);
            return result.observation;
          });
      const watchController =
        (controllerSessionId: string): GameRunParticipant["watch"] =>
        (onEvent, signal) =>
          watchControllerSessionVisuals({
            ownerControllerSessionId: summary.controllerSessionId,
            controllerSessionId,
            onEvent,
            signal,
          });
      return {
        summary,
        clock: room?.clock ?? wallClock,
        watch: watchController(summary.controllerSessionId),
        watchHost: (onEvent, signal) =>
          watchControllerSessionVisuals({
            ownerControllerSessionId: summary.controllerSessionId,
            onEvent,
            signal,
          }),
        async readParticipants() {
          const state = await readRuntimeSnapshot({
            controllerSessionId: summary.controllerSessionId,
            requestSync: false,
          });
          if (!state.connected)
            throw new Error("seat_replaced: Primary player is disconnected.");
          return {
            roomId: state.roomId,
            controllerIds: playerProfileSchema
              .array()
              .parse(state.players)
              .map((player) => player.id),
          };
        },
        checkConnected: () =>
          checkParticipant(summary.controllerSessionId, summary.controllerId),
        observe: observeParticipant(
          summary.controllerSessionId,
          summary.controllerId,
        ),
        control: (input) =>
          controlGameSessionParticipant({ ...input, gameSessionId }),
        async addParticipant(nickname) {
          const delegatedId = delegation ? seatControllerIds.shift() : null;
          if (delegation && !delegatedId)
            throw new Error(
              "current_room_scope: The creator's room issued no further seat.",
            );
          const controller = await connectController({
            cwd: summary.cwd,
            gameId: summary.gameId ?? undefined,
            controllerJoinUrl: summary.controllerJoinUrl,
            controllerId:
              delegatedId ?? `ctrl_agent_${randomUUID().replaceAll("-", "")}`,
            deviceId: `airjam-agent-${randomUUID()}`,
            nickname,
          });
          let disconnected:
            | Awaited<ReturnType<typeof disconnectController>>
            | undefined;
          const dispose = async (disconnect: typeof disconnectController) => {
            const result = (disconnected ??= await disconnect({
              controllerSessionId: controller.controllerSessionId,
            }));
            return { release: result.release, leave: result.leave };
          };
          return {
            controllerId: controller.controllerId,
            watch: watchController(controller.controllerSessionId),
            checkConnected: () =>
              checkParticipant(
                controller.controllerSessionId,
                controller.controllerId,
              ),
            observe: observeParticipant(
              controller.controllerSessionId,
              controller.controllerId,
            ),
            control: (input) =>
              session.operations.run(DEFAULT_TIMEOUT_MS, () =>
                controlControllerParticipant({
                  ...input,
                  controllerSessionId: controller.controllerSessionId,
                }),
              ),
            close: () => dispose(disconnectController),
            forceClose: () => dispose(forceDisconnectController),
          } satisfies GameRunParticipant;
        },
        invokeHost: async (actionId, payload) => {
          const result = await invokeGameSessionAction({
            gameSessionId,
            actionId: `host:${actionId}`,
            payload,
          });
          if (!result.invocation.acknowledgement.ok)
            throw new Error("Host setup action was rejected.");
          return result;
        },
        close: () => closeGameSession({ gameSessionId }),
        forceClose: () =>
          disposeGameSession({ gameSessionId }, forceDisconnectController),
      };
    },
  };
}
