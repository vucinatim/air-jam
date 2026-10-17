import type { AirJamActionInvocationResult } from "@air-jam/sdk";
import {
  AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
  arcadeSurfaceRuntimeIdentitySchema,
  embeddedReplicatedStoreDomainFromArcadeIdentity,
  localReferenceSourceGameId,
} from "@air-jam/sdk/arcade/surface";
import {
  controllerBridgeServerEvents,
  controllerBridgeSnapshotSchema,
} from "@air-jam/sdk/controller-bridge";
import type {
  AirJamStateSyncPayload,
  ClientToServerEvents,
  ControllerJoinAck,
  ControllerJoinedNotice,
  ControllerLeaveAck,
  ControllerStateMessage,
  ControllerWelcomePayload,
  PlayerProfile,
  PlayerUpdatedNotice,
  ServerErrorPayload,
  ServerToClientEvents,
  SignalPayload,
} from "@air-jam/sdk/protocol";
import {
  controllerLeasedControlAckSchema,
  controllerLeasedControlSchema,
  controllerStateSchema,
  playerProfileSchema,
  type ControllerLeasedControl,
  type ControllerLeasedControlAck,
} from "@air-jam/sdk/protocol";
import type {
  HostAgentRequest,
  HostAgentResponse,
  HostRuntimeActionRequest,
} from "@air-jam/sdk/runtime-control";
import {
  AIR_JAM_RUNTIME_INSPECTION_KEY,
  readRuntimeInspectionContract,
  type HostRuntimeInspectionContract,
} from "@air-jam/sdk/runtime-inspection";
import { parseRuntimeTopologyFromSearchParams } from "@air-jam/sdk/runtime-topology";
import type { ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { io, type Socket } from "socket.io-client";
import { z } from "zod";
import { detectProjectContext } from "./context.js";
import { getTopology } from "./dev.js";
import type { PinnedGameBuild } from "./game-build-protocol.js";
import type { GameSurfaceWatchEvent } from "./game-run-watch.js";
import { inspectGame } from "./games.js";
import {
  resolveDevtoolsHelperArgs,
  resolveDevtoolsHelperScript,
  resolveProjectDevtoolsHelperScript,
} from "./helper-scripts.js";
import {
  closeScopedProcess,
  spawnScopedProcess,
  type ProcessScopeObserver,
} from "./managed-process-scope.js";
import {
  AIR_JAM_RUNTIME_OWNER_ACTION_REQUEST,
  AIR_JAM_RUNTIME_OWNER_CAPTURE_REQUEST,
  isRuntimeOwnerActionResult,
  isRuntimeOwnerCaptureResult,
  runtimeOwnerAgentResultSchema,
  runtimeOwnerCaptureReadSchema,
  runtimeOwnerWatchEventSchema,
  type AirJamRuntimeOwnerCaptureResult,
} from "./runtime-owner-protocol.js";
import type {
  AirJamProjectMode,
  AirJamRuntimeSnapshotInspection,
  AirJamRuntimeStoreSnapshot,
  AirJamVirtualControllerSession,
  AirJamVirtualControllerSessionSummary,
  ConnectControllerOptions,
  DisconnectControllerOptions,
  DisconnectControllerResult,
  GetTopologyOptions,
  InvokeControllerActionOptions,
  InvokeControllerActionResult,
  JsonObject,
  ReadRuntimeSnapshotOptions,
  SendControllerInputOptions,
  SendControllerInputResult,
} from "./types.js";

export type {
  AirJamRuntimeSnapshotInspection,
  AirJamRuntimeStoreSnapshot,
  AirJamVirtualControllerSession,
  AirJamVirtualControllerSessionSummary,
  ConnectControllerOptions,
  DisconnectControllerOptions,
  DisconnectControllerResult,
  InvokeControllerActionOptions,
  InvokeControllerActionResult,
  ReadRuntimeSnapshotOptions,
  SendControllerInputOptions,
  SendControllerInputResult,
} from "./types.js";

type ControllerSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

type PendingStateSyncWaiter = {
  requestId: string;
  minimumRevision: number;
  resolve: (snapshot: AirJamRuntimeStoreSnapshot | null) => void;
};

type InternalControllerSession = {
  cwd: string;
  summary: AirJamVirtualControllerSessionSummary;
  socket: ControllerSocket;
  projectMode: AirJamProjectMode;
  welcome: JsonObject | null;
  controllerState: JsonObject | null;
  players: JsonObject[];
  storeSnapshots: Map<string, AirJamRuntimeStoreSnapshot>;
  pendingSyncWaiters: Map<string, Set<PendingStateSyncWaiter>>;
  lastSignal: JsonObject | null;
  lastError: JsonObject | null;
  isolatedRuntimeOwner: ChildProcess | null;
  resumeCapabilityToken: string | null;
  participantLeaseId: string | null;
  participantLastCommand: ControllerLeasedControl | null;
  participantControlPending: boolean;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_VISUAL_CAPTURE_TIMEOUT_MS = 15_000;
const WAIT_INTERVAL_MS = 25;
const virtualControllerSessions = new Map<string, InternalControllerSession>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toJsonObject = (value: unknown): JsonObject | null => {
  if (!isRecord(value)) {
    return null;
  }

  return { ...value };
};

const toJsonObjectArray = (value: unknown): JsonObject[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const objectValue = toJsonObject(entry);
    return objectValue ? [objectValue] : [];
  });
};

const upsertPlayer = (
  players: JsonObject[],
  incoming: PlayerProfile | JsonObject | null,
): JsonObject[] => {
  const nextPlayer = toJsonObject(incoming);
  const playerId =
    typeof nextPlayer?.id === "string" && nextPlayer.id ? nextPlayer.id : null;
  if (!nextPlayer || !playerId) {
    return players;
  }

  const nextPlayers = players.slice();
  const existingIndex = nextPlayers.findIndex((entry) => entry.id === playerId);
  if (existingIndex === -1) {
    nextPlayers.push(nextPlayer);
    return nextPlayers;
  }

  nextPlayers[existingIndex] = {
    ...nextPlayers[existingIndex],
    ...nextPlayer,
  };
  return nextPlayers;
};

const removePlayer = (
  players: JsonObject[],
  controllerId: string,
): JsonObject[] => players.filter((entry) => entry.id !== controllerId);

const nowIso = (): string => new Date().toISOString();

const waitForCondition = async ({
  timeoutMs,
  predicate,
}: {
  timeoutMs: number;
  predicate: () => boolean;
}): Promise<void> => {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt >= timeoutMs) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, WAIT_INTERVAL_MS));
  }
};

const waitForSocketConnect = async (
  socket: ControllerSocket,
  timeoutMs: number,
): Promise<void> => {
  if (socket.connected) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for controller socket connect."));
    }, timeoutMs);

    const onConnect = () => {
      cleanup();
      resolve();
    };

    const onConnectError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      socket.off("connect", onConnect);
      socket.off("connect_error", onConnectError);
    };

    socket.once("connect", onConnect);
    socket.once("connect_error", onConnectError);
  });
};

const emitJoinWithAck = async ({
  socket,
  payload,
  timeoutMs,
}: {
  socket: ControllerSocket;
  payload: Parameters<ClientToServerEvents["controller:join"]>[0];
  timeoutMs: number;
}): Promise<ControllerJoinAck> =>
  await new Promise<ControllerJoinAck>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Timed out waiting for controller join acknowledgement."),
      );
    }, timeoutMs);

    socket.emit("controller:join", payload, (ack) => {
      clearTimeout(timeout);
      resolve(ack);
    });
  });

const emitLeaveWithAck = async ({
  socket,
  payload,
  timeoutMs,
}: {
  socket: ControllerSocket;
  payload: Parameters<ClientToServerEvents["controller:leave"]>[0];
  timeoutMs: number;
}): Promise<ControllerLeaveAck> =>
  await new Promise<ControllerLeaveAck>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Timed out waiting for controller leave acknowledgement."),
      );
    }, timeoutMs);

    (
      socket as unknown as {
        emit: (event: string, ...args: unknown[]) => void;
      }
    ).emit("controller:leave", payload, (ack: ControllerLeaveAck) => {
      clearTimeout(timeout);
      resolve(ack);
    });
  });

const emitControllerActionWithAck = async ({
  socket,
  payload,
  timeoutMs,
}: {
  socket: ControllerSocket;
  payload: Parameters<ClientToServerEvents["controller:action_rpc"]>[0];
  timeoutMs: number;
}): Promise<
  Parameters<
    NonNullable<Parameters<ClientToServerEvents["controller:action_rpc"]>[1]>
  >[0]
> =>
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error("Timed out waiting for controller action acknowledgement."),
      );
    }, timeoutMs);

    socket.emit("controller:action_rpc", payload, (ack) => {
      clearTimeout(timeout);
      resolve(ack);
    });
  });

const requestOwnedHostAction = async ({
  owner,
  payload,
  timeoutMs,
}: {
  owner: ChildProcess;
  payload: HostRuntimeActionRequest;
  timeoutMs: number;
}): Promise<AirJamActionInvocationResult> =>
  await new Promise((resolve) => {
    const requestId = randomUUID();
    const finish = (ack: AirJamActionInvocationResult) => {
      clearTimeout(timeout);
      owner.off("message", onMessage);
      owner.off("exit", onExit);
      owner.off("disconnect", onExit);
      owner.off("error", onError);
      resolve(ack);
    };
    const onError = () =>
      finish({
        ok: false,
        status: "rejected",
        source: "client",
        reason: "host_ack_missing",
        message:
          "The owned host runtime disconnected before its acknowledgement was observed.",
      });
    const onExit = () => onError();
    const onMessage = (message: unknown) => {
      if (
        isRuntimeOwnerActionResult(message) &&
        message.requestId === requestId
      )
        finish(message.acknowledgement);
    };
    const timeout = setTimeout(() => {
      finish({
        ok: false,
        status: "rejected",
        source: "client",
        reason: "host_ack_timeout",
        message: "Timed out waiting for the owned host action acknowledgement.",
      });
    }, timeoutMs);
    owner.on("message", onMessage);
    owner.once("exit", onExit);
    owner.once("disconnect", onExit);
    owner.once("error", onError);
    try {
      owner.send(
        {
          type: AIR_JAM_RUNTIME_OWNER_ACTION_REQUEST,
          requestId,
          action: payload,
        },
        (error) => {
          if (error) onError();
        },
      );
    } catch {
      onError();
    }
  });

const parseJoinRoomId = (joinUrl: URL): string | null => {
  const roomId =
    joinUrl.searchParams.get("room") ?? joinUrl.searchParams.get("aj_room");
  return roomId?.trim().toUpperCase() || null;
};

const parseJoinCapabilityToken = (joinUrl: URL): string | null =>
  joinUrl.searchParams.get("aj_controller_cap")?.trim() ||
  joinUrl.searchParams.get("cap")?.trim() ||
  null;

const parseJoinControllerId = (joinUrl: URL): string | null =>
  joinUrl.searchParams.get("controllerId")?.trim() ||
  joinUrl.searchParams.get("aj_controller_id")?.trim() ||
  null;

const terminateIsolatedRuntimeOwner = closeScopedProcess;

const resolveSocketOriginFromTopology = async (
  options: GetTopologyOptions,
): Promise<string | null> => {
  try {
    const topology = await getTopology(options);
    const preferredSurfaces = [
      topology.surfaces.controller,
      topology.surfaces.embeddedController,
      topology.surfaces.platformController,
    ];

    for (const surface of preferredSurfaces) {
      const objectSurface = toJsonObject(surface);
      const socketOrigin =
        (typeof objectSurface?.socketOrigin === "string"
          ? objectSurface.socketOrigin
          : null) ??
        (typeof objectSurface?.backendOrigin === "string"
          ? objectSurface.backendOrigin
          : null) ??
        (typeof objectSurface?.appOrigin === "string"
          ? objectSurface.appOrigin
          : null);
      if (socketOrigin) {
        return socketOrigin;
      }
    }
  } catch {
    // Fall back to the join URL origin below.
  }

  return null;
};

const resolveControllerJoinUrlFromTopology = async ({
  cwd,
  gameId,
  mode,
  secure,
  roomId,
  capabilityToken,
}: {
  cwd: string;
  gameId?: string;
  mode: NonNullable<ConnectControllerOptions["mode"]>;
  secure: boolean;
  roomId?: string;
  capabilityToken?: string;
}): Promise<string | null> => {
  if (!roomId) {
    return null;
  }

  const topology = await getTopology({
    cwd,
    gameId,
    mode,
    secure,
  });
  if (!topology.urls.controllerBaseUrl) {
    return null;
  }

  const joinUrl = new URL(topology.urls.controllerBaseUrl);
  joinUrl.searchParams.set("room", roomId);
  if (capabilityToken?.trim()) {
    joinUrl.searchParams.set("aj_controller_cap", capabilityToken.trim());
  }

  return joinUrl.toString();
};

const startIsolatedRuntimeOwner = async ({
  cwd,
  gameId,
  mode,
  secure,
  timeoutMs,
  build,
  onScope,
}: {
  cwd: string;
  onScope?: ProcessScopeObserver;
  build?: PinnedGameBuild;
  gameId?: string;
  mode: NonNullable<ConnectControllerOptions["mode"]>;
  secure: boolean;
  timeoutMs: number;
}): Promise<{
  process: ChildProcess;
  roomId: string | null;
  controllerJoinUrl: string | null;
  inspection: HostRuntimeInspectionContract | null;
}> => {
  const topology = build
    ? null
    : await getTopology({
        cwd,
        gameId,
        mode,
        secure,
      });

  const appOrigin = topology?.urls.appOrigin;
  const hostUrl = topology?.urls.hostUrl;
  const controllerBaseUrl = topology?.urls.controllerBaseUrl;
  const publicHost = topology?.urls.publicHost;
  if (!build && (!appOrigin || !hostUrl || !controllerBaseUrl || !publicHost)) {
    throw new Error(
      "Unable to start an isolated runtime owner because the resolved topology is incomplete.",
    );
  }

  const helperFile = build
    ? resolveProjectDevtoolsHelperScript(build.rootDir, "hold-runtime-host.ts")
    : resolveDevtoolsHelperScript("hold-runtime-host.ts");
  const args = [
    ...resolveDevtoolsHelperArgs(helperFile),
    "--mode",
    mode,
    "--timeout-ms",
    String(timeoutMs),
  ];
  if (build) args.push("--pinned-build", build.manifestPath);
  else {
    for (const [flag, value] of [
      ["--app-origin", appOrigin],
      ["--host-url", hostUrl],
      ["--controller-base-url", controllerBaseUrl],
      ["--public-host", publicHost],
      ["--local-build-url", topology?.urls.localBuildUrl],
      ["--browser-build-url", topology?.urls.browserBuildUrl],
    ] as const)
      if (value) args.push(flag, value);
  }
  const helperProcess = await spawnScopedProcess(args, {
    cwd,
    onScope,
  });

  return await new Promise((resolve, reject) => {
    let stderrBuffer = "";
    let settled = false;
    const timeout = setTimeout(() => {
      cleanup();
      void terminateIsolatedRuntimeOwner(helperProcess).finally(() => {
        const stderrSummary = stderrBuffer.trim();
        const stderrSuffix = stderrSummary
          ? ` Helper stderr: ${stderrSummary}`
          : "";
        reject(
          new Error(
            "Timed out waiting for isolated runtime ownership. Another local game session may still own the isolated runtime lease, or no host page may be available to create a room. Run `pnpm exec airjam status` to inspect local dev processes; if the state looks stale, run `pnpm exec airjam reset local` and then reopen the host page." +
              stderrSuffix,
          ),
        );
      });
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      helperProcess.off("message", onReady);
      helperProcess.stderr?.off("data", onStderr);
      helperProcess.off("exit", onExit);
      helperProcess.off("error", onError);
    };

    const onReady = (message: unknown) => {
      const result = z
        .object({
          type: z.literal("air-jam-runtime-owner.ready/v1"),
          roomId: z.string().nullable(),
          controllerJoinUrl: z.string().nullable(),
          inspection: z.unknown(),
        })
        .safeParse(message);
      if (!result.success) return;
      const inspection = readRuntimeInspectionContract({
        [AIR_JAM_RUNTIME_INSPECTION_KEY]: result.data.inspection,
      });
      if (inspection?.role !== "host") {
        cleanup();
        void terminateIsolatedRuntimeOwner(helperProcess).then(
          () =>
            reject(
              new Error(
                "Isolated runtime owner returned an invalid host inspection.",
              ),
            ),
          reject,
        );
        return;
      }
      settled = true;
      cleanup();
      resolve({
        process: helperProcess,
        roomId: result.data.roomId,
        controllerJoinUrl: result.data.controllerJoinUrl,
        inspection,
      });
    };

    const onStderr = (chunk: Buffer | string) => {
      stderrBuffer = (stderrBuffer + chunk.toString()).slice(-262144);
    };

    const onError = (error: Error) => {
      if (settled) {
        return;
      }
      cleanup();
      reject(error);
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (settled) {
        return;
      }
      cleanup();
      reject(
        new Error(
          [
            "Isolated runtime owner exited before producing a join URL.",
            stderrBuffer.trim(),
            `exit=${code ?? "null"} signal=${signal ?? "null"}`,
          ]
            .filter(Boolean)
            .join("\n"),
        ),
      );
    };

    helperProcess.stdout?.resume();
    helperProcess.on("message", onReady);
    helperProcess.stderr?.on("data", onStderr);
    helperProcess.once("error", onError);
    helperProcess.once("exit", onExit);
  });
};

function relayControllerObservation(
  session: InternalControllerSession,
  owner: ChildProcess,
  requestId: string,
  onError: (error: Error) => void,
) {
  const snapshot = controllerBridgeSnapshotSchema.parse({
    harnessSessionId: session.summary.controllerSessionId,
    roomId: session.summary.roomId,
    controllerId: session.summary.controllerId,
    connected: session.summary.connected,
    socketId: session.socket.id,
    player: playerProfileSchema.parse(
      session.players.find(
        (player) => player.id === session.summary.controllerId,
      ),
    ),
    players: session.players.map((player) => playerProfileSchema.parse(player)),
    state: controllerStateSchema.shape.state.parse(session.controllerState),
  });
  const allowedEvents = new Set<string>(controllerBridgeServerEvents);
  const forwardEvent = (event: string, ...args: unknown[]) => {
    if (allowedEvents.has(event))
      owner.send(
        {
          type: "air-jam-runtime-owner.capture-event/v1",
          requestId,
          event,
          args,
        },
        (error) => {
          if (error) onError(error);
        },
      );
  };
  const readRequest = (message: unknown) => {
    const read = runtimeOwnerCaptureReadSchema.safeParse(message);
    if (!read.success || read.data.captureRequestId !== requestId) return;
    if (read.data.payload.roomId !== session.summary.roomId) {
      onError(new Error("Observation read belongs to another room."));
      return;
    }
    const store = session.storeSnapshots.get(read.data.payload.storeDomain);
    if (!store) {
      onError(
        new Error(
          `Observation state is not available for ${read.data.payload.storeDomain}.`,
        ),
      );
      return;
    }
    forwardEvent("airjam:state_sync", {
      roomId: session.summary.roomId,
      storeDomain: store.storeDomain,
      requestId: read.data.payload.requestId,
      revision: store.revision,
      data: store.data,
    });
  };
  session.socket.onAny(forwardEvent);
  owner.on("message", readRequest);
  return {
    snapshot,
    stores: Array.from(session.storeSnapshots.values(), (store) => ({
      roomId: session.summary.roomId,
      storeDomain: store.storeDomain,
      data: store.data,
      revision: store.revision,
    })),
    close() {
      session.socket.offAny(forwardEvent);
      owner.off("message", readRequest);
    },
  };
}

export const captureControllerSessionVisuals = async ({
  controllerSessionId,
  relativeDir,
  timeoutMs = DEFAULT_VISUAL_CAPTURE_TIMEOUT_MS,
}: {
  controllerSessionId: string;
  relativeDir: string;
  timeoutMs?: number;
}) => {
  const session = getRequiredSession(controllerSessionId);
  const owner = session.isolatedRuntimeOwner;
  if (!session.summary.connected)
    throw new Error(
      "The acting controller must be connected for visual capture.",
    );
  if (!owner?.connected) {
    throw new Error(
      `Air Jam controller session "${controllerSessionId}" does not own a capturable host runtime. Capture from the first game session opened for the room.`,
    );
  }

  const requestId = randomUUID();
  const result = await new Promise<AirJamRuntimeOwnerCaptureResult>(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for runtime visual capture."));
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timeout);
        relay.close();
        session.socket.off("disconnect", onDisconnect);
        owner.off("message", onMessage);
        owner.off("error", onError);
        owner.off("exit", onExit);
      };
      const onMessage = (message: unknown) => {
        if (
          !isRuntimeOwnerCaptureResult(message) ||
          message.requestId !== requestId
        ) {
          return;
        }
        cleanup();
        if (!message.ok) {
          reject(new Error(message.error ?? "Runtime visual capture failed."));
          return;
        }
        resolve(message);
      };
      const onError = (error: Error) => {
        cleanup();
        reject(error);
      };
      const onDisconnect = () => {
        cleanup();
        reject(
          new Error(
            "Acting controller disconnected before visual capture completed.",
          ),
        );
      };
      const onExit = (code: number | null) => {
        cleanup();
        reject(
          new Error(
            `Runtime owner exited before visual capture completed (code ${code ?? "unknown"}).`,
          ),
        );
      };

      const relay = relayControllerObservation(
        session,
        owner,
        requestId,
        onError,
      );
      owner.on("message", onMessage);
      owner.once("error", onError);
      owner.once("exit", onExit);
      session.socket.once("disconnect", onDisconnect);
      owner.send(
        {
          type: AIR_JAM_RUNTIME_OWNER_CAPTURE_REQUEST,
          requestId,
          relativeDir,
          snapshot: relay.snapshot,
          stores: relay.stores,
        },
        (error) => {
          if (error) onError(error);
        },
      );
    },
  );

  return {
    capturedAt: result.capturedAt,
    screenshots: result.screenshots,
  };
};

const buildRuntimeSnapshot = ({
  session,
  requestedStoreDomains = [],
  missingStoreDomains = [],
}: {
  session: InternalControllerSession;
  requestedStoreDomains?: string[];
  missingStoreDomains?: string[];
}): AirJamRuntimeSnapshotInspection => ({
  ...session.summary,
  welcome: session.welcome,
  controllerState: session.controllerState,
  players: session.players.slice(),
  storeSnapshots: Array.from(session.storeSnapshots.values()).sort(
    (left, right) => left.storeDomain.localeCompare(right.storeDomain),
  ),
  lastSignal: session.lastSignal,
  lastError: session.lastError,
  requestedStoreDomains: [...requestedStoreDomains],
  missingStoreDomains: [...missingStoreDomains],
});

const buildSessionSummary = (
  session: InternalControllerSession,
): AirJamVirtualControllerSessionSummary => ({
  ...session.summary,
});

export const ownsControllerSessionHost = (
  controllerSessionId: string,
): boolean => {
  const owner = getRequiredSession(controllerSessionId).isolatedRuntimeOwner;
  return Boolean(owner?.connected && !owner.killed && owner.exitCode === null);
};

const getRequiredSession = (
  controllerSessionId: string,
): InternalControllerSession => {
  const session = virtualControllerSessions.get(controllerSessionId);
  if (!session) {
    throw new Error(
      `Unknown Air Jam controller session "${controllerSessionId}". Connect a controller first.`,
    );
  }

  return session;
};

export const inspectControllerSessionContext = (
  controllerSessionId: string,
): {
  cwd: string;
  gameId: string | null;
  controllerId: string;
  session: AirJamVirtualControllerSessionSummary;
} => {
  const session = getRequiredSession(controllerSessionId);
  return {
    cwd: session.cwd,
    gameId: session.summary.gameId,
    controllerId: session.summary.controllerId,
    session: buildSessionSummary(session),
  };
};

export const resolveControllerSessionGameRuntime = async ({
  controllerSessionId,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  controllerSessionId: string;
  timeoutMs?: number;
}): Promise<{
  gameId: string | null;
  defaultStoreDomain: string;
}> => {
  const session = getRequiredSession(controllerSessionId);
  const usesArcadeRuntime =
    session.summary.mode === "arcade-dev" ||
    session.summary.mode === "arcade-test" ||
    session.summary.topologyMode === "arcade-live" ||
    session.summary.topologyMode === "arcade-built";

  if (!usesArcadeRuntime) {
    return {
      gameId: session.summary.gameId,
      defaultStoreDomain: "default",
    };
  }

  const minimumRevision =
    session.storeSnapshots.get(AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN)?.revision ??
    0;
  const surfaceSnapshot = await waitForStateSync({
    session,
    storeDomain: AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
    minimumRevision,
    timeoutMs,
  });
  // Replicated surface state also contains presentation fields. Validate its
  // identity projection without weakening the strict bridge identity contract.
  const surfaceData = surfaceSnapshot?.data;
  const parsedSurface = arcadeSurfaceRuntimeIdentitySchema.safeParse({
    epoch: surfaceData?.epoch,
    kind: surfaceData?.kind,
    gameId: surfaceData?.gameId,
  });

  if (!parsedSurface.success) {
    throw new Error(
      `Arcade controller session "${controllerSessionId}" did not expose a valid "${AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN}" snapshot.`,
    );
  }

  if (parsedSurface.data.kind !== "game" || !parsedSurface.data.gameId) {
    session.summary.gameId = null;
    throw new Error(
      `Arcade controller session "${controllerSessionId}" does not currently have an active embedded game.`,
    );
  }

  const sourceGameId =
    session.projectMode === "standalone-game"
      ? (await inspectGame({ cwd: session.cwd })).id
      : (localReferenceSourceGameId(parsedSurface.data.gameId) ??
        parsedSurface.data.gameId);
  session.summary.gameId = sourceGameId;

  return {
    gameId: sourceGameId,
    defaultStoreDomain: embeddedReplicatedStoreDomainFromArcadeIdentity(
      parsedSurface.data,
    ),
  };
};

const waitForStateSync = async ({
  session,
  storeDomain,
  minimumRevision,
  timeoutMs,
}: {
  session: InternalControllerSession;
  storeDomain: string;
  minimumRevision: number;
  timeoutMs: number;
}): Promise<AirJamRuntimeStoreSnapshot | null> =>
  await new Promise<AirJamRuntimeStoreSnapshot | null>((resolve) => {
    const requestId = randomUUID();
    const waiters = session.pendingSyncWaiters.get(storeDomain) ?? new Set();
    const timeout = setTimeout(() => {
      waiters.delete(waiter);
      if (waiters.size === 0) {
        session.pendingSyncWaiters.delete(storeDomain);
      }
      resolve(null);
    }, timeoutMs);

    const waiter: PendingStateSyncWaiter = {
      requestId,
      minimumRevision,
      resolve: (snapshot) => {
        clearTimeout(timeout);
        waiters.delete(waiter);
        if (waiters.size === 0) {
          session.pendingSyncWaiters.delete(storeDomain);
        }
        resolve(snapshot);
      },
    };

    waiters.add(waiter);
    session.pendingSyncWaiters.set(storeDomain, waiters);
    session.socket.emit("controller:state_sync_request", {
      roomId: session.summary.roomId,
      storeDomain,
      requestId,
    });
  });

const resolvePendingStateSyncWaiters = ({
  session,
  snapshot,
  requestId,
}: {
  session: InternalControllerSession;
  snapshot: AirJamRuntimeStoreSnapshot;
  requestId?: string;
}): void => {
  const waiters = session.pendingSyncWaiters.get(snapshot.storeDomain);
  if (!waiters) {
    return;
  }

  for (const waiter of Array.from(waiters)) {
    if (requestId !== waiter.requestId) {
      continue;
    }
    if (snapshot.revision < waiter.minimumRevision) {
      continue;
    }
    waiter.resolve(snapshot);
  }
};

const attachSocketListeners = (session: InternalControllerSession): void => {
  session.socket.on("server:welcome", (payload: ControllerWelcomePayload) => {
    session.welcome = {
      ...payload,
    };
    session.players = toJsonObjectArray(payload.players);
  });

  session.socket.on("server:state", (payload: ControllerStateMessage) => {
    session.controllerState = toJsonObject(payload.state);
  });

  session.socket.on(
    "server:controllerJoined",
    (payload: ControllerJoinedNotice) => {
      const fallbackPlayer =
        payload.player ??
        ({
          id: payload.controllerId,
          label: payload.nickname ?? payload.controllerId,
        } satisfies JsonObject);
      session.players = upsertPlayer(session.players, fallbackPlayer);
    },
  );

  session.socket.on("server:controllerLeft", (payload) => {
    session.players = removePlayer(session.players, payload.controllerId);
  });

  session.socket.on("server:playerUpdated", (payload: PlayerUpdatedNotice) => {
    session.players = upsertPlayer(session.players, payload.player);
  });

  session.socket.on("server:signal", (payload: SignalPayload) => {
    session.lastSignal = toJsonObject(payload);
  });

  session.socket.on("server:error", (payload: ServerErrorPayload) => {
    session.lastError = toJsonObject(payload);
  });

  session.socket.on("airjam:state_sync", (payload: AirJamStateSyncPayload) => {
    const previousSnapshot = session.storeSnapshots.get(payload.storeDomain);
    if (previousSnapshot && payload.revision < previousSnapshot.revision) {
      return;
    }

    const snapshot: AirJamRuntimeStoreSnapshot = {
      storeDomain: payload.storeDomain,
      data: { ...payload.data },
      updatedAt: nowIso(),
      revision: payload.revision,
    };
    session.storeSnapshots.set(payload.storeDomain, snapshot);
    resolvePendingStateSyncWaiters({
      session,
      snapshot,
      requestId: payload.requestId,
    });
  });

  session.socket.on("disconnect", (reason) => {
    session.summary.connected = false;
    session.summary.disconnectedAt = nowIso();
    session.summary.disconnectReason = reason ?? "unknown";
    void terminateIsolatedRuntimeOwner(session.isolatedRuntimeOwner).then(
      () => {
        session.isolatedRuntimeOwner = null;
      },
      (error) => console.error(error),
    );
    for (const waiters of session.pendingSyncWaiters.values()) {
      for (const waiter of waiters) {
        waiter.resolve(null);
      }
    }
    session.pendingSyncWaiters.clear();
  });
};

export const connectController = async (
  {
    cwd = process.cwd(),
    gameId,
    mode = "standalone-dev",
    secure = false,
    roomId,
    controllerJoinUrl,
    controllerId,
    deviceId,
    nickname,
    avatarId,
    capabilityToken,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: ConnectControllerOptions = {},
  {
    build,
    onScope,
  }: { build?: PinnedGameBuild; onScope?: ProcessScopeObserver } = {},
): Promise<AirJamVirtualControllerSession> => {
  const context = await detectProjectContext({ cwd });
  const normalizedRequestedRoomId = roomId?.trim().toUpperCase() || undefined;
  const normalizedCapabilityToken = capabilityToken?.trim() || undefined;
  const canUseIsolatedOwner =
    !normalizedRequestedRoomId &&
    !controllerJoinUrl &&
    (Boolean(gameId) || context.mode === "standalone-game");

  const connectWithJoinUrl = async ({
    joinUrlString,
    ownedRuntimeProcess,
  }: {
    joinUrlString: string;
    ownedRuntimeProcess: ChildProcess | null;
  }): Promise<AirJamVirtualControllerSession> => {
    const joinUrl = new URL(joinUrlString);
    const resolvedRoomId =
      normalizedRequestedRoomId ?? parseJoinRoomId(joinUrl);
    if (!resolvedRoomId) {
      throw new Error(
        `Controller join URL "${joinUrlString}" does not include a room code.`,
      );
    }

    const resolvedControllerId =
      controllerId?.trim() ||
      parseJoinControllerId(joinUrl) ||
      `ctrl_mcp_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
    const resolvedDeviceId =
      deviceId?.trim() || `aj-mcp-device-${randomUUID()}`;
    const topology = await getTopology({
      cwd,
      gameId,
      mode,
      secure,
    }).catch(() => null);
    const resolvedGameId = gameId ?? topology?.gameId ?? null;
    const resolvedSocketOrigin =
      parseRuntimeTopologyFromSearchParams(joinUrl.searchParams)
        ?.socketOrigin ??
      (controllerJoinUrl
        ? joinUrl.origin
        : ((await resolveSocketOriginFromTopology({
            cwd,
            gameId: resolvedGameId ?? undefined,
            mode,
            secure,
          })) ?? joinUrl.origin));
    const resolvedCapabilityToken =
      normalizedCapabilityToken ||
      parseJoinCapabilityToken(joinUrl) ||
      undefined;
    const controllerSessionId = randomUUID();

    const socket = io(resolvedSocketOrigin, {
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    }) as ControllerSocket;

    const internalSession: InternalControllerSession = {
      cwd,
      summary: {
        controllerSessionId,
        gameId: resolvedGameId,
        projectMode: context.mode,
        mode,
        topologyMode: build
          ? "self-hosted-production"
          : (topology?.topologyMode ?? null),
        secure,
        process: topology?.process ?? null,
        roomId: resolvedRoomId,
        controllerId: resolvedControllerId,
        deviceId: resolvedDeviceId,
        controllerJoinUrl: joinUrlString,
        socketOrigin: resolvedSocketOrigin,
        connected: false,
        connectedAt: nowIso(),
        disconnectedAt: null,
        disconnectReason: null,
      },
      socket,
      projectMode: context.mode,
      welcome: null,
      controllerState: null,
      players: [],
      storeSnapshots: new Map(),
      pendingSyncWaiters: new Map(),
      lastSignal: null,
      lastError: null,
      isolatedRuntimeOwner: ownedRuntimeProcess,
      resumeCapabilityToken: null,
      participantLeaseId: null,
      participantLastCommand: null,
      participantControlPending: false,
    };

    attachSocketListeners(internalSession);

    try {
      await waitForSocketConnect(socket, timeoutMs);
      const ack = await emitJoinWithAck({
        socket,
        payload: {
          roomId: resolvedRoomId,
          controllerId: resolvedControllerId,
          deviceId: resolvedDeviceId,
          nickname: nickname?.trim() || undefined,
          avatarId: avatarId?.trim() || undefined,
          capabilityToken: resolvedCapabilityToken,
          resumeCapabilityToken:
            internalSession.resumeCapabilityToken ?? undefined,
        },
        timeoutMs,
      });

      if (!ack.ok) {
        throw new Error(
          ack.message ??
            `Controller join was rejected${ack.code ? ` (${ack.code})` : ""}.`,
        );
      }

      internalSession.resumeCapabilityToken =
        ack.resumeCapabilityToken ?? internalSession.resumeCapabilityToken;

      internalSession.summary.connected = true;
      internalSession.summary.roomId = ack.roomId ?? resolvedRoomId;
      internalSession.summary.controllerId =
        ack.controllerId ?? resolvedControllerId;
      await waitForCondition({
        timeoutMs: Math.min(timeoutMs, 500),
        predicate: () =>
          internalSession.welcome !== null &&
          internalSession.controllerState !== null,
      });
      virtualControllerSessions.set(controllerSessionId, internalSession);
      return buildRuntimeSnapshot({ session: internalSession });
    } catch (error) {
      socket.disconnect();
      await terminateIsolatedRuntimeOwner(ownedRuntimeProcess);
      throw error;
    }
  };

  const resolvedJoinUrl = build
    ? null
    : (controllerJoinUrl ??
      (await resolveControllerJoinUrlFromTopology({
        cwd,
        gameId,
        mode,
        secure,
        roomId: normalizedRequestedRoomId,
        capabilityToken: normalizedCapabilityToken,
      })));
  if (!resolvedJoinUrl) {
    if (!canUseIsolatedOwner) {
      throw new Error(
        "Unable to resolve a controller join URL. Open the host page first so a room exists, or provide roomId/controllerJoinUrl explicitly. If a stale dev process may be holding the local runtime, run `pnpm exec airjam status` and then `pnpm exec airjam reset local`.",
      );
    }

    const owner = await startIsolatedRuntimeOwner({
      cwd,
      gameId,
      mode,
      secure,
      timeoutMs,
      build,
      onScope,
    });
    if (!owner.controllerJoinUrl) {
      await terminateIsolatedRuntimeOwner(owner.process);
      throw new Error(
        "Isolated runtime owner did not produce a controller join URL.",
      );
    }

    return connectWithJoinUrl({
      joinUrlString: owner.controllerJoinUrl,
      ownedRuntimeProcess: owner.process,
    });
  }

  return connectWithJoinUrl({
    joinUrlString: resolvedJoinUrl,
    ownedRuntimeProcess: null,
  });
};

export const sendControllerInput = async ({
  controllerSessionId,
  input,
}: SendControllerInputOptions): Promise<SendControllerInputResult> => {
  const session = getRequiredSession(controllerSessionId);
  if (!session.summary.connected) {
    throw new Error(
      `Air Jam controller session "${controllerSessionId}" is not connected.`,
    );
  }

  if (session.participantLeaseId)
    throw new Error(
      "participant_control_leased: Use the leased control path for this player.",
    );
  const payload = { ...input };
  session.socket.emit("controller:input", {
    roomId: session.summary.roomId,
    controllerId: session.summary.controllerId,
    input: payload,
  });

  return {
    ...buildSessionSummary(session),
    input: payload,
    sentAt: nowIso(),
  };
};

export async function controlControllerParticipant({
  controllerSessionId,
  ...input
}: {
  controllerSessionId: string;
} & Omit<
  ControllerLeasedControl,
  "roomId" | "controllerId"
>): Promise<ControllerLeasedControlAck> {
  const session = getRequiredSession(controllerSessionId);
  const request = controllerLeasedControlSchema.parse({
    ...input,
    roomId: session.summary.roomId,
    controllerId: session.summary.controllerId,
  });
  if (!session.summary.connected)
    return { status: "rejected", reason: "unauthorized" };
  if (
    session.participantLeaseId &&
    session.participantLeaseId !== request.lease.id
  )
    return { status: "rejected", reason: "lease_conflict" };
  if (session.participantControlPending)
    return { status: "rejected", reason: "busy" };
  session.participantLeaseId = request.lease.id;
  session.participantControlPending = true;
  if (
    !session.participantLastCommand ||
    request.lease.sequence > session.participantLastCommand.lease.sequence
  )
    session.participantLastCommand = request;
  try {
    let acknowledgement: unknown;
    try {
      acknowledgement = await session.socket
        .timeout(2000)
        .emitWithAck("controller:leasedControl", request);
    } catch {
      return { status: "unconfirmed", reason: "transport_ack_unavailable" };
    }
    const parsed = controllerLeasedControlAckSchema.safeParse(acknowledgement);
    if (
      !parsed.success ||
      (parsed.data.status === "applied" &&
        (parsed.data.leaseId !== request.lease.id ||
          parsed.data.sequence !== request.lease.sequence ||
          parsed.data.operation.kind !== request.operation.kind))
    )
      return { status: "unconfirmed", reason: "invalid_acknowledgement" };
    return parsed.data;
  } finally {
    session.participantControlPending = false;
  }
}

export const invokeControllerAction = async ({
  controllerSessionId,
  actionName,
  storeDomain,
  payload,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: InvokeControllerActionOptions): Promise<InvokeControllerActionResult> => {
  const session = getRequiredSession(controllerSessionId);
  if (!session.summary.connected) {
    throw new Error(
      `Air Jam controller session "${controllerSessionId}" is not connected.`,
    );
  }

  if (session.participantLeaseId)
    throw new Error(
      "participant_control_leased: Use the leased control path for this player.",
    );
  const normalizedPayload = payload ? { ...payload } : undefined;
  const acknowledgement = await emitControllerActionWithAck({
    socket: session.socket,
    payload: {
      roomId: session.summary.roomId,
      actionName,
      payload: normalizedPayload,
      storeDomain,
    },
    timeoutMs,
  });

  return {
    ...buildSessionSummary(session),
    actionName,
    storeDomain,
    ...(normalizedPayload ? { payload: normalizedPayload } : {}),
    sentAt: nowIso(),
    acknowledgement,
  };
};

export const invokeHostAction = async ({
  controllerSessionId,
  actionName,
  storeDomain,
  payload,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  controllerSessionId: string;
  actionName: string;
  storeDomain: string;
  payload?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<InvokeControllerActionResult> => {
  const session = getRequiredSession(controllerSessionId);
  if (!session.summary.connected) {
    throw new Error(
      `Air Jam controller session "${controllerSessionId}" is not connected.`,
    );
  }

  const normalizedPayload = payload ? { ...payload } : undefined;
  const owner = session.isolatedRuntimeOwner;
  const acknowledgement: AirJamActionInvocationResult =
    owner && ownsControllerSessionHost(controllerSessionId)
      ? await requestOwnedHostAction({
          owner,
          payload: {
            roomId: session.summary.roomId,
            actionName,
            payload: normalizedPayload,
            storeDomain,
          },
          timeoutMs,
        })
      : {
          ok: false,
          status: "rejected",
          source: "client",
          reason: "host_runtime_not_owned",
          message:
            "Host actions require an owned host runtime; room attachments provide player participation only.",
        };

  return {
    ...buildSessionSummary(session),
    actionName,
    storeDomain,
    ...(normalizedPayload ? { payload: normalizedPayload } : {}),
    sentAt: nowIso(),
    acknowledgement,
  };
};

export const readRuntimeSnapshot = async ({
  controllerSessionId,
  storeDomains = [],
  requestSync = storeDomains.length > 0,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ReadRuntimeSnapshotOptions): Promise<AirJamRuntimeSnapshotInspection> => {
  const session = getRequiredSession(controllerSessionId);
  const normalizedStoreDomains = Array.from(
    new Set(
      storeDomains
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );

  const missingStoreDomains: string[] = [];
  if (requestSync && normalizedStoreDomains.length > 0) {
    const syncResults = await Promise.all(
      normalizedStoreDomains.map(async (storeDomain) => {
        const minimumRevision =
          session.storeSnapshots.get(storeDomain)?.revision ?? 0;
        const result = await waitForStateSync({
          session,
          storeDomain,
          minimumRevision,
          timeoutMs,
        });
        return {
          storeDomain,
          ok: result !== null,
        };
      }),
    );

    for (const result of syncResults) {
      if (!result.ok) {
        missingStoreDomains.push(result.storeDomain);
      }
    }
  }

  return buildRuntimeSnapshot({
    session,
    requestedStoreDomains: normalizedStoreDomains,
    missingStoreDomains,
  });
};

async function disposeControllerSession(session: InternalControllerSession) {
  const owner = session.isolatedRuntimeOwner;
  session.socket.disconnect();
  session.summary.connected = false;
  session.summary.disconnectedAt ??= nowIso();
  session.summary.disconnectReason ??= "manual_disconnect";
  await terminateIsolatedRuntimeOwner(owner);
  session.isolatedRuntimeOwner = null;
  virtualControllerSessions.delete(session.summary.controllerSessionId);
}

export async function forceDisconnectController({
  controllerSessionId,
}: DisconnectControllerOptions): Promise<DisconnectControllerResult> {
  const session = getRequiredSession(controllerSessionId);
  await disposeControllerSession(session);
  return {
    disconnected: true,
    release: { status: "unconfirmed", reason: "runtime_unavailable" },
    leave: {
      status: "unconfirmed",
      message:
        "Forced local transport/runtime teardown; server leave was not confirmed.",
    },
    session: buildSessionSummary(session),
  };
}

export const disconnectController = async ({
  controllerSessionId,
}: DisconnectControllerOptions): Promise<DisconnectControllerResult> => {
  const session = getRequiredSession(controllerSessionId);
  const last = session.participantLastCommand;
  const release: DisconnectControllerResult["release"] = last
    ? last.lease.sequence === Number.MAX_SAFE_INTEGER
      ? { status: "rejected", reason: "invalid_request" }
      : await controlControllerParticipant({
          controllerSessionId,
          expected: last.expected,
          lease: { id: last.lease.id, sequence: last.lease.sequence + 1 },
          operation: { kind: "release" },
        })
    : { status: "not-leased" };
  let leave: DisconnectControllerResult["leave"] = { status: "not-connected" };
  if (session.summary.connected) {
    try {
      const raw = await emitLeaveWithAck({
        socket: session.socket,
        payload: {
          roomId: session.summary.roomId,
          controllerId: session.summary.controllerId,
        },
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      const parsed = z
        .object({
          ok: z.boolean(),
          message: z.string().optional(),
          code: z.string().optional(),
        })
        .safeParse(raw);
      leave = parsed.success
        ? parsed.data.ok
          ? { status: "acknowledged" }
          : {
              status: "rejected",
              message: parsed.data.message ?? "Controller leave was rejected.",
            }
        : {
            status: "unconfirmed",
            message: "Invalid controller leave acknowledgement.",
          };
    } catch (error) {
      leave = {
        status: "unconfirmed",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
  await disposeControllerSession(session);

  return {
    disconnected: true,
    leave,
    release,
    session: buildSessionSummary(session),
  };
};

export async function requestControllerHostAgent(
  controllerSessionId: string,
  request: HostAgentRequest,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<HostAgentResponse> {
  const owner = getRequiredSession(controllerSessionId).isolatedRuntimeOwner;
  if (!owner || !ownsControllerSessionHost(controllerSessionId))
    throw new Error(
      "contract_runtime_not_owned: Semantic testing requires an owned host. Open a game session without an explicit room or join URL.",
    );
  return new Promise((resolve, reject) => {
    const requestId = randomUUID();
    let settled = false;
    const finish = (error?: Error, result?: HostAgentResponse) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      owner.off("message", onMessage);
      owner.off("error", onError);
      owner.off("exit", onExit);
      owner.off("disconnect", onExit);
      signal?.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else if (result) resolve(result);
    };
    const onMessage = (message: unknown) => {
      if (
        !message ||
        typeof message !== "object" ||
        !("type" in message) ||
        message.type !== "air-jam-runtime-owner.agent-result/v1" ||
        !("requestId" in message) ||
        message.requestId !== requestId
      )
        return;
      const parsed = runtimeOwnerAgentResultSchema.safeParse(message);
      if (!parsed.success) {
        finish(
          new Error(
            "invalid_runtime_response: Owned host returned an invalid agent response.",
          ),
        );
        return;
      }
      if (parsed.data.ok) finish(undefined, parsed.data.result);
      else finish(new Error(parsed.data.error));
    };
    const onError = (error: Error) => finish(error);
    const onExit = () =>
      finish(
        new Error("runtime_disconnected: Owned host exited during evaluation."),
      );
    const onAbort = () =>
      finish(new Error("session_closed: Evaluation was cancelled."));
    const timer = setTimeout(
      () =>
        finish(
          new Error("evaluation_timeout: Owned game evaluation timed out."),
        ),
      timeoutMs,
    );
    owner.on("message", onMessage);
    owner.once("error", onError);
    owner.once("exit", onExit);
    owner.once("disconnect", onExit);
    signal?.addEventListener("abort", onAbort, { once: true });
    if (signal?.aborted) {
      onAbort();
      return;
    }
    try {
      owner.send(
        { type: "air-jam-runtime-owner.agent/v1", requestId, request },
        (error) => {
          if (error) onError(error);
        },
      );
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  });
}

export async function watchControllerSessionVisuals({
  ownerControllerSessionId,
  controllerSessionId,
  onEvent,
  signal,
}: {
  ownerControllerSessionId: string;
  controllerSessionId?: string;
  onEvent: (event: GameSurfaceWatchEvent) => void;
  signal: AbortSignal;
}): Promise<void> {
  signal.throwIfAborted();
  const session = getRequiredSession(ownerControllerSessionId);
  const owner = session.isolatedRuntimeOwner;
  if (!owner?.connected)
    throw new Error("Run watch requires its owned host runtime.");
  const target = controllerSessionId
    ? getRequiredSession(controllerSessionId)
    : undefined;
  if (
    target &&
    (!target.summary.connected ||
      target.summary.roomId !== session.summary.roomId)
  )
    throw new Error("Run watch controller is not connected to the owned room.");
  const watchId = randomUUID();
  await new Promise<void>((resolve, reject) => {
    let stopping = false;
    let failed: Error | undefined;
    const cleanup = () => {
      clearTimeout(timeout);
      owner.off("message", message);
      owner.off("error", error);
      owner.off("exit", exit);
      signal.removeEventListener("abort", stop);
      relay?.close();
    };
    const settle = (failure?: Error) => {
      cleanup();
      if (failure) reject(failure);
      else resolve();
    };
    let timeout = setTimeout(
      () => error(new Error("Timed out starting the game watch.")),
      DEFAULT_VISUAL_CAPTURE_TIMEOUT_MS,
    );
    const stop = () => {
      if (stopping) return;
      stopping = true;
      clearTimeout(timeout);
      timeout = setTimeout(
        () => settle(new Error("Timed out closing the game watch.")),
        DEFAULT_VISUAL_CAPTURE_TIMEOUT_MS,
      );
      owner.send(
        { type: "air-jam-runtime-owner.watch-stop/v1", watchId },
        (failure) => {
          if (failure) settle(failure);
        },
      );
    };
    const error = (failure: Error) => {
      failed ??= failure;
      stop();
    };
    const exit = () =>
      settle(new Error("Game watch owner exited before its stream closed."));
    const message = (value: unknown) => {
      const parsed = runtimeOwnerWatchEventSchema.safeParse(value);
      if (!parsed.success || parsed.data.watchId !== watchId) return;
      const event = parsed.data.event;
      if (event.type === "closed") {
        settle(failed);
        return;
      }
      if (event.type === "error") {
        if (stopping) {
          settle(new Error(event.message));
          return;
        }
        error(new Error(event.message));
        return;
      }
      if (stopping) return;
      if (event.type === "ready") clearTimeout(timeout);
      try {
        onEvent(event);
      } catch (failure) {
        error(failure instanceof Error ? failure : new Error(String(failure)));
      }
    };
    const relay = target
      ? relayControllerObservation(target, owner, watchId, error)
      : undefined;
    owner.on("message", message);
    owner.once("error", error);
    owner.once("exit", exit);
    signal.addEventListener("abort", stop, { once: true });
    if (signal.aborted) {
      stop();
      return;
    }
    owner.send(
      {
        type: "air-jam-runtime-owner.watch/v1",
        watchId,
        surface: target ? "controller" : "host",
        ...(relay ? { snapshot: relay.snapshot, stores: relay.stores } : {}),
      },
      (failure) => {
        if (failure) error(failure);
      },
    );
  });
}
