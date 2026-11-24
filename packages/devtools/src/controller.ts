import type { AirJamActionInvocationResult } from "@air-jam/sdk";
import {
  AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
  arcadeSurfaceRuntimeIdentitySchema,
  embeddedReplicatedStoreDomainFromArcadeIdentity,
  localReferenceSourceGameId,
} from "@air-jam/sdk/arcade/surface";
import {
  agentValuesToInputState,
  airJamActionResultOf,
  type AirJamInput,
  type AirJamInputState,
} from "@air-jam/sdk/core";
import {
  controllerLeasedControlAckSchema,
  leasedControlRequestSchema,
  type ControllerLeasedControlAck,
  type LeasedControlRequest,
} from "@air-jam/sdk/protocol";
import {
  AIRJAM_CONTROL_CHANNEL,
  AIRJAM_LEASED_CONTROL_REQUEST,
  AIRJAM_PRESENTATION_CHANNEL,
  encodeInputPayload,
  encodePhoneInputFrame,
  type RoomLink,
  type StateDocument,
} from "@air-jam/sdk/room-protocol";
import {
  createRoomKey,
  createScopedPhoneConnector,
  createWebSocketConnector,
  PhoneRoomSession,
  serveRoomPort,
  type RoomSessionStatus,
} from "@air-jam/sdk/room-session";
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
  AIR_JAM_RUNTIME_OWNER_CAPTURE_PORT,
  AIR_JAM_RUNTIME_OWNER_CAPTURE_REQUEST,
  isRuntimeOwnerActionResult,
  isRuntimeOwnerCaptureResult,
  runtimeOwnerAgentResultSchema,
  runtimeOwnerCaptureFrameSchema,
  runtimeOwnerWatchEventSchema,
  type AirJamRuntimeOwnerCaptureResult,
} from "./runtime-owner-protocol.js";
import type {
  AirJamGameInspection,
  AirJamProjectMode,
  AirJamRuntimeSnapshotInspection,
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

type InternalControllerSession = {
  cwd: string;
  summary: AirJamVirtualControllerSessionSummary;
  room: PhoneRoomSession;
  projectMode: AirJamProjectMode;
  /** When each channel this phone mirrors last changed, and how many times. */
  storeUpdates: Map<string, { revision: number; updatedAt: string }>;
  lastSignal: JsonObject | null;
  lastError: JsonObject | null;
  isolatedRuntimeOwner: ChildProcess | null;
  participantLeaseId: string | null;
  participantLastCommand: LeasedControlRequest | null;
  /** The controls this session last sent, so buttons count presses. */
  inputState: AirJamInputState | null;
  /** The game's declared controls, read once the first input is sent; null when the game declares none. */
  inputLayout: AirJamInput | null | undefined;
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

/** Waits until the phone's room welcomes it, or ends with why it could not join. */
const waitForWelcome = (room: PhoneRoomSession, timeoutMs: number) =>
  new Promise<void>((resolve, reject) => {
    const settle = (status: RoomSessionStatus) => {
      if (status.phase === "open") finish();
      else if (status.phase === "closed")
        finish(new Error(`Controller join was refused (${status.reason}).`));
    };
    const finish = (error?: Error) => {
      clearTimeout(timer);
      stop();
      if (error) reject(error);
      else resolve();
    };
    const timer = setTimeout(
      () =>
        finish(
          new Error(
            "Timed out waiting for the room to welcome the controller.",
          ),
        ),
      timeoutMs,
    );
    const stop = room.on("status", settle);
    settle(room.status);
  });

/** A channel's copy as this phone mirrors it, waiting up to `timeoutMs` for its first. */
const waitForChannel = async (
  room: PhoneRoomSession,
  channel: string,
  timeoutMs: number,
): Promise<StateDocument | null> => {
  await waitForCondition({
    timeoutMs,
    predicate: () => room.channel(channel) !== undefined,
  });
  return room.channel(channel) ?? null;
};

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
}: {
  cwd: string;
  gameId?: string;
  mode: NonNullable<ConnectControllerOptions["mode"]>;
  secure: boolean;
  roomId?: string;
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
  return joinUrl.toString();
};

const startIsolatedRuntimeOwner = async ({
  cwd,
  gameId,
  mode,
  secure,
  timeoutMs,
  build,
  settings,
  onScope,
}: {
  settings?: Record<string, number | boolean | string>;
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
  if (settings) args.push("--settings", JSON.stringify(settings));
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

/**
 * Serves the observed controller page the acting phone's room, read-only:
 * the owner relays the page's room port here over IPC, and this side serves
 * it as a view of the acting phone's session. The page sees what the phone
 * sees; nothing it sends reaches the room.
 */
function relayControllerObservation(
  session: InternalControllerSession,
  owner: ChildProcess,
  requestId: string,
  onError: (error: Error) => void,
) {
  const listeners = new Set<(event: MessageEvent) => void>();
  const fromOwner = (message: unknown) => {
    const frame = runtimeOwnerCaptureFrameSchema.safeParse(message);
    if (!frame.success || frame.data.requestId !== requestId) return;
    for (const listener of listeners)
      listener({ data: frame.data.message } as MessageEvent);
  };
  const port = {
    addEventListener: (_: "message", listener: (event: MessageEvent) => void) =>
      listeners.add(listener),
    removeEventListener: (
      _: "message",
      listener: (event: MessageEvent) => void,
    ) => listeners.delete(listener),
    start: () => {},
    postMessage: (message: unknown) =>
      owner.send(
        { type: AIR_JAM_RUNTIME_OWNER_CAPTURE_PORT, requestId, message },
        (error) => {
          if (error) onError(error);
        },
      ),
  } as unknown as MessagePort;
  const scoped = createScopedPhoneConnector(session.room, () => true);
  const stopServing = serveRoomPort(port, (address, handlers) => {
    const link = scoped.connector(address, handlers);
    let greeted = false;
    const readOnly: RoomLink = {
      ...link,
      send: (data) => {
        if (!greeted || data === "ping") link.send(data);
        greeted = true;
      },
    };
    return readOnly;
  });
  owner.on("message", fromOwner);
  return {
    close() {
      stopServing();
      scoped.close();
      owner.off("message", fromOwner);
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
        stopFollowing();
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
      const stopFollowing = session.room.on("status", (status) => {
        if (status.phase === "open") return;
        cleanup();
        reject(
          new Error(
            "Acting controller disconnected before visual capture completed.",
          ),
        );
      });
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
      owner.send(
        {
          type: AIR_JAM_RUNTIME_OWNER_CAPTURE_REQUEST,
          requestId,
          relativeDir,
          harnessSessionId: session.summary.controllerSessionId,
          roomId: session.summary.roomId,
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
}): AirJamRuntimeSnapshotInspection => {
  const room = session.room;
  return {
    ...session.summary,
    welcome: room.instance
      ? {
          roomId: room.code,
          instance: room.instance,
          controllerId: room.seat,
        }
      : null,
    controllerState: (room.channel(AIRJAM_PRESENTATION_CHANNEL) ??
      null) as JsonObject | null,
    players: room.seats.map((seat) => ({ ...seat })),
    storeSnapshots: [...room.documents()]
      .map(([storeDomain, data]) => ({
        storeDomain,
        data: data as JsonObject,
        revision: session.storeUpdates.get(storeDomain)?.revision ?? 0,
        updatedAt:
          session.storeUpdates.get(storeDomain)?.updatedAt ??
          session.summary.connectedAt,
      }))
      .sort((left, right) => left.storeDomain.localeCompare(right.storeDomain)),
    lastSignal: session.lastSignal,
    lastError: session.lastError,
    requestedStoreDomains: [...requestedStoreDomains],
    missingStoreDomains: [...missingStoreDomains],
  };
};

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
  game,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  controllerSessionId: string;
  timeoutMs?: number;
  game?: AirJamGameInspection;
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

  const surfaceData = (await waitForChannel(
    session.room,
    AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
    timeoutMs,
  )) as Record<string, unknown> | null;
  // Replicated surface state also contains presentation fields. Validate its
  // identity projection without weakening the strict bridge identity contract.
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
      ? (game ?? (await inspectGame({ cwd: session.cwd }))).id
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

/** Follows the phone's room: its status, its channels' changes and its signals. */
const followRoom = (session: InternalControllerSession): void => {
  const room = session.room;
  room.on("status", (status) => {
    if (status.phase === "open") {
      session.summary.connected = true;
      session.summary.controllerId = room.seat ?? session.summary.controllerId;
      return;
    }
    if (status.phase !== "closed") return;
    session.summary.connected = false;
    session.summary.disconnectedAt = nowIso();
    session.summary.disconnectReason = status.reason;
    if (status.reason !== "owner" && status.reason !== "left")
      session.lastError = { reason: status.reason };
    void terminateIsolatedRuntimeOwner(session.isolatedRuntimeOwner).then(
      () => {
        session.isolatedRuntimeOwner = null;
      },
      (error) => console.error(error),
    );
  });
  room.on("state", ({ channel }) => {
    const previous = session.storeUpdates.get(channel)?.revision ?? 0;
    session.storeUpdates.set(channel, {
      revision: previous + 1,
      updatedAt: nowIso(),
    });
  });
  room.on("signal", (signal) => {
    session.lastSignal = {
      kind: signal.kind,
      payload: signal.payload,
    } as JsonObject;
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
    nickname,
    avatarId,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: ConnectControllerOptions = {},
  {
    build,
    onScope,
    settings,
  }: {
    build?: PinnedGameBuild;
    onScope?: ProcessScopeObserver;
    settings?: Record<string, number | boolean | string>;
  } = {},
): Promise<AirJamVirtualControllerSession> => {
  const context = await detectProjectContext({ cwd });
  const normalizedRequestedRoomId = roomId?.trim().toUpperCase() || undefined;
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

    const topology = controllerJoinUrl
      ? null
      : await getTopology({ cwd, gameId, mode, secure }).catch(() => null);
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
    const controllerSessionId = randomUUID();
    const label = nickname?.trim().slice(0, 24);
    const avatar = avatarId?.trim();

    const room = new PhoneRoomSession({
      connector: createWebSocketConnector(resolvedSocketOrigin),
      key: createRoomKey(),
      code: resolvedRoomId,
      kind: "agent",
      deviceWakeEvents: null,
      ...(label || avatar
        ? {
            profile: {
              ...(label ? { label } : {}),
              ...(avatar ? { avatarId: avatar } : {}),
            },
          }
        : {}),
    });

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
        controllerId: "",
        controllerJoinUrl: joinUrlString,
        socketOrigin: resolvedSocketOrigin,
        connected: false,
        connectedAt: nowIso(),
        disconnectedAt: null,
        disconnectReason: null,
      },
      room,
      projectMode: context.mode,
      storeUpdates: new Map(),
      lastSignal: null,
      lastError: null,
      isolatedRuntimeOwner: ownedRuntimeProcess,
      participantLeaseId: null,
      participantLastCommand: null,
      inputState: null,
      inputLayout: undefined,
    };

    followRoom(internalSession);

    try {
      await waitForWelcome(room, timeoutMs);
      // A host in the room publishes its presentation at once; a summary
      // without it reads as a room whose host is away.
      await waitForChannel(
        room,
        AIRJAM_PRESENTATION_CHANNEL,
        Math.min(timeoutMs, 500),
      );
      virtualControllerSessions.set(controllerSessionId, internalSession);
      return buildRuntimeSnapshot({ session: internalSession });
    } catch (error) {
      room.close();
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
      settings,
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
  session.inputLayout ??=
    (await inspectGame({
      cwd: session.cwd,
      ...(session.summary.gameId ? { gameId: session.summary.gameId } : {}),
    }).then(
      (game) => game.declaration.input,
      () => null,
    )) ?? null;
  const layout = session.inputLayout;
  if (!layout)
    throw new Error(
      "input_unavailable: This controller's game declares no controls it can read.",
    );
  // An agent sends values; a button turns into a press each time it goes down.
  const payload = {
    ...session.inputState,
    ...agentValuesToInputState(session.inputState, input),
  };
  session.inputState = payload;
  session.room.sendInputFrame(
    encodePhoneInputFrame(encodeInputPayload(layout, payload)),
  );

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
} & LeasedControlRequest): Promise<ControllerLeasedControlAck> {
  const session = getRequiredSession(controllerSessionId);
  const request = leasedControlRequestSchema.parse(input);
  if (!session.summary.connected)
    return { status: "rejected", reason: "unauthorized" };
  if (
    session.participantLeaseId &&
    session.participantLeaseId !== request.lease.id
  )
    return { status: "rejected", reason: "lease_conflict" };
  session.participantLeaseId = request.lease.id;
  if (
    !session.participantLastCommand ||
    request.lease.sequence > session.participantLastCommand.lease.sequence
  )
    session.participantLastCommand = request;
  const outcome = await session.room.request(
    AIRJAM_CONTROL_CHANNEL,
    AIRJAM_LEASED_CONTROL_REQUEST,
    request,
    { exclusive: true, timeoutMs: 2000 },
  );
  if (outcome.status === "busy") return { status: "rejected", reason: "busy" };
  if (outcome.status === "refused")
    return { status: "rejected", reason: "active_host_missing" };
  if (outcome.status === "unconfirmed")
    return { status: "unconfirmed", reason: "transport_ack_unavailable" };
  const parsed = controllerLeasedControlAckSchema.safeParse(outcome.result);
  if (
    !parsed.success ||
    (parsed.data.status === "applied" &&
      (parsed.data.leaseId !== request.lease.id ||
        parsed.data.sequence !== request.lease.sequence ||
        parsed.data.operation.kind !== request.operation.kind))
  )
    return { status: "unconfirmed", reason: "invalid_acknowledgement" };
  return parsed.data;
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
  const acknowledgement = airJamActionResultOf(
    await session.room.request(storeDomain, actionName, normalizedPayload, {
      timeoutMs,
    }),
  );

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
      normalizedStoreDomains.map(async (storeDomain) => ({
        storeDomain,
        ok:
          (await waitForChannel(session.room, storeDomain, timeoutMs)) !== null,
      })),
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
  session.room.close();
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
    session.room.leave();
    await waitForCondition({
      timeoutMs: DEFAULT_TIMEOUT_MS,
      predicate: () => session.room.status.phase === "closed",
    });
    const status = session.room.status;
    leave =
      status.phase === "closed" && status.reason === "left"
        ? { status: "acknowledged" }
        : {
            status: "unconfirmed",
            message: "The room did not confirm the seat was given up.",
          };
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
        ...(target
          ? {
              harnessSessionId: target.summary.controllerSessionId,
              roomId: target.summary.roomId,
            }
          : {}),
      },
      (failure) => {
        if (failure) error(failure);
      },
    );
  });
}
