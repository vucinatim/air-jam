import type {
  ChildHostCapability,
  ControllerPrivilegedCapability,
  ControllerPrivilegedGrant,
  ControllerStateMessage,
  HostArcadeSessionSnapshot,
  RoomCode,
} from "@air-jam/sdk/protocol";
import type { Server } from "socket.io";
import type {
  ControllerSession,
  RoomLifecycleState,
  RoomSession,
} from "../types.js";

type AirJamIoServer = Server;

export interface TransitionToSystemFocusOptions {
  resetGameState?: boolean;
  notifyMasterCloseChild?: boolean;
  resyncPlayersToMaster?: boolean;
}

interface RoomStateMessageOverrides {
  message?: string;
}

export type RoomLifecyclePhase = RoomLifecycleState;

export interface LaunchAvailability {
  ok: boolean;
  reason?: "GAME_ACTIVE" | "LAUNCH_PENDING" | "ROOM_CLOSING" | "ROOM_TORN_DOWN";
}

export interface ChildHostActivationAvailability {
  ok: boolean;
  reason?:
    | "GAME_ACTIVE"
    | "NO_LAUNCH_PENDING"
    | "ROOM_CLOSING"
    | "ROOM_TORN_DOWN";
}

export interface LifecycleTransitionAvailability {
  ok: boolean;
  reason?: "INVALID_TRANSITION";
}

const ROOM_LIFECYCLE_TRANSITIONS: Record<
  RoomLifecycleState,
  RoomLifecycleState[]
> = {
  SYSTEM_IDLE: ["GAME_LAUNCH_PENDING", "CLOSING", "TEARDOWN"],
  GAME_LAUNCH_PENDING: ["GAME_ACTIVE", "SYSTEM_IDLE", "CLOSING"],
  GAME_ACTIVE: ["SYSTEM_IDLE", "CLOSING"],
  CLOSING: ["SYSTEM_IDLE", "TEARDOWN"],
  TEARDOWN: [],
};

export const canTransitionRoomLifecycle = (
  session: RoomSession,
  nextState: RoomLifecycleState,
): LifecycleTransitionAvailability => {
  if (session.lifecycleState === nextState) {
    return { ok: true };
  }

  const allowed = ROOM_LIFECYCLE_TRANSITIONS[session.lifecycleState] ?? [];
  if (!allowed.includes(nextState)) {
    return { ok: false, reason: "INVALID_TRANSITION" };
  }

  return { ok: true };
};

export const transitionRoomLifecycle = (
  session: RoomSession,
  nextState: RoomLifecycleState,
): LifecycleTransitionAvailability => {
  const availability = canTransitionRoomLifecycle(session, nextState);
  if (!availability.ok) {
    return availability;
  }

  session.lifecycleState = nextState;
  return { ok: true };
};

export const getRoomLifecyclePhase = (
  session: RoomSession,
): RoomLifecyclePhase => {
  return session.lifecycleState;
};

/**
 * Delay before tearing down an arcade game after the child host socket drops.
 * Override with `AIR_JAM_CHILD_HOST_TEARDOWN_MS` (tests use a low value).
 */
export const getChildHostDisconnectTeardownMs = (): number => {
  const raw = process.env.AIR_JAM_CHILD_HOST_TEARDOWN_MS;
  if (raw === undefined || raw === "") {
    return 4000;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 4000;
};

/**
 * Child-host launch capabilities are room/game scoped and only valid for the current launch.
 * Keep them long enough for normal refresh/reconnect behavior, but never longer than the launch session itself.
 */
export const getChildHostCapabilityTtlMs = (): number => {
  const raw = process.env.AIR_JAM_CHILD_HOST_CAPABILITY_TTL_MS;
  if (raw === undefined || raw === "") {
    return 24 * 60 * 60 * 1000;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : 24 * 60 * 60 * 1000;
};

/**
 * Grace window for controller refresh/reconnect before the player binding is
 * removed from the room. Override in tests with `AIR_JAM_CONTROLLER_RESUME_LEASE_MS`.
 */
export const getControllerResumeLeaseMs = (): number => {
  const raw = process.env.AIR_JAM_CONTROLLER_RESUME_LEASE_MS;
  if (raw === undefined || raw === "") {
    return 30_000;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 30_000;
};

export const issueChildHostCapability = (
  token: string,
  now = Date.now(),
): ChildHostCapability => ({
  token,
  expiresAt: now + getChildHostCapabilityTtlMs(),
});

export const isChildHostCapabilityExpired = (
  capability: ChildHostCapability,
  now = Date.now(),
): boolean => capability.expiresAt <= now;

export const getControllerCapabilityTtlMs = (): number => {
  const raw = process.env.AIR_JAM_CONTROLLER_CAPABILITY_TTL_MS;
  if (raw === undefined || raw === "") {
    return 24 * 60 * 60 * 1000;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : 24 * 60 * 60 * 1000;
};

const DEFAULT_CONTROLLER_PRIVILEGED_GRANTS: ControllerPrivilegedGrant[] = [
  "system",
  "play_sound",
  "action_rpc",
];

export const issueControllerPrivilegedCapability = (
  token: string,
  grants: ControllerPrivilegedGrant[] = DEFAULT_CONTROLLER_PRIVILEGED_GRANTS,
  now = Date.now(),
): ControllerPrivilegedCapability => ({
  token,
  expiresAt: now + getControllerCapabilityTtlMs(),
  grants,
});

export const isControllerPrivilegedCapabilityExpired = (
  capability: ControllerPrivilegedCapability,
  now = Date.now(),
): boolean => capability.expiresAt <= now;

export const canBeginGameLaunch = (
  session: RoomSession,
): LaunchAvailability => {
  const phase = getRoomLifecyclePhase(session);
  if (phase === "CLOSING") {
    return { ok: false, reason: "ROOM_CLOSING" };
  }
  if (phase === "TEARDOWN") {
    return { ok: false, reason: "ROOM_TORN_DOWN" };
  }
  if (phase === "GAME_ACTIVE") {
    return { ok: false, reason: "GAME_ACTIVE" };
  }
  if (phase === "GAME_LAUNCH_PENDING") {
    return { ok: false, reason: "LAUNCH_PENDING" };
  }
  return { ok: true };
};

export const startGameLaunch = (
  session: RoomSession,
  launchCapability: ChildHostCapability,
  gameId: string,
): void => {
  session.launchCapability = launchCapability;
  session.activeGameId = gameId;
};

export const beginGameLaunch = (
  session: RoomSession,
  launchCapability: ChildHostCapability,
  gameId: string,
): LaunchAvailability => {
  const launchAvailability = canBeginGameLaunch(session);
  if (!launchAvailability.ok) {
    return launchAvailability;
  }

  transitionRoomLifecycle(session, "GAME_LAUNCH_PENDING");
  startGameLaunch(session, launchCapability, gameId);
  return { ok: true };
};

/**
 * Snapshot for host `host:reconnect` ack so the client can restore arcade UI after refresh.
 */
export const buildArcadeSessionForHostAck = (
  session: RoomSession,
  issueToken?: () => string,
): HostArcadeSessionSnapshot | undefined => {
  if (!session.activeGameId) {
    return undefined;
  }
  const phase = session.lifecycleState;
  if (phase !== "GAME_ACTIVE" && phase !== "GAME_LAUNCH_PENDING") {
    return undefined;
  }
  const currentCapability = session.launchCapability;
  if (currentCapability && !isChildHostCapabilityExpired(currentCapability)) {
    return {
      gameId: session.activeGameId,
      launchCapability: currentCapability,
    };
  }
  if (!issueToken) {
    return undefined;
  }
  const refreshedCapability = issueChildHostCapability(issueToken());
  session.launchCapability = refreshedCapability;
  return {
    gameId: session.activeGameId,
    launchCapability: refreshedCapability,
  };
};

export const buildControllerCapabilityForHostAck = (
  session: RoomSession,
  issueToken?: () => string,
): ControllerPrivilegedCapability | undefined => {
  const currentCapability = session.controllerCapability;
  if (
    currentCapability &&
    !isControllerPrivilegedCapabilityExpired(currentCapability)
  ) {
    return currentCapability;
  }
  if (!issueToken) {
    return currentCapability;
  }
  const refreshedCapability = issueControllerPrivilegedCapability(issueToken());
  session.controllerCapability = refreshedCapability;
  return refreshedCapability;
};

export const canActivateChildHost = (
  session: RoomSession,
): ChildHostActivationAvailability => {
  const phase = getRoomLifecyclePhase(session);
  if (phase === "CLOSING") {
    return { ok: false, reason: "ROOM_CLOSING" };
  }
  if (phase === "TEARDOWN") {
    return { ok: false, reason: "ROOM_TORN_DOWN" };
  }
  if (phase === "GAME_ACTIVE") {
    return { ok: false, reason: "GAME_ACTIVE" };
  }
  if (phase !== "GAME_LAUNCH_PENDING") {
    return { ok: false, reason: "NO_LAUNCH_PENDING" };
  }
  return { ok: true };
};

export const activateChildHost = (
  session: RoomSession,
  childHostSocketId: string,
): void => {
  transitionRoomLifecycle(session, "GAME_ACTIVE");
  session.childHostSocketId = childHostSocketId;
  session.focus = "GAME";
};

export const activateEmbeddedGame = (session: RoomSession): void => {
  transitionRoomLifecycle(session, "GAME_ACTIVE");
  session.childHostSocketId = undefined;
  session.focus = "GAME";
};

export const beginChildHostActivation = (
  session: RoomSession,
  childHostSocketId: string,
): ChildHostActivationAvailability => {
  const activationAvailability = canActivateChildHost(session);
  if (!activationAvailability.ok) {
    return activationAvailability;
  }

  activateChildHost(session, childHostSocketId);
  return { ok: true };
};

export const resetRoomToSystemState = (
  session: RoomSession,
  resetGameState = false,
): void => {
  session.focus = "SYSTEM";
  session.childHostSocketId = undefined;
  session.launchCapability = undefined;
  session.activeGameId = undefined;
  transitionRoomLifecycle(session, "SYSTEM_IDLE");
  if (resetGameState) {
    session.runtimeState = "paused";
    session.controllerOrientation = "portrait";
  }
};

export const beginRoomClosing = (
  session: RoomSession,
): LifecycleTransitionAvailability => {
  if (session.lifecycleState === "CLOSING") {
    return { ok: true };
  }
  if (session.lifecycleState === "TEARDOWN") {
    return { ok: false, reason: "INVALID_TRANSITION" };
  }

  return transitionRoomLifecycle(session, "CLOSING");
};

export const markRoomTeardown = (
  session: RoomSession,
): LifecycleTransitionAvailability => {
  if (session.lifecycleState === "TEARDOWN") {
    return { ok: true };
  }

  return transitionRoomLifecycle(session, "TEARDOWN");
};

export const toControllerJoinedNotice = (
  controller: ControllerSession,
  options: {
    resumed?: boolean;
  } = {},
) => ({
  controllerId: controller.controllerId,
  nickname: controller.nickname,
  resumed: options.resumed,
  player: controller.playerProfile,
});

export const emitRoomState = (
  io: AirJamIoServer,
  roomId: RoomCode,
  session: RoomSession,
  {
    message,
    bumpVersion = true,
  }: RoomStateMessageOverrides & { bumpVersion?: boolean } = {},
): ControllerStateMessage => {
  if (bumpVersion) {
    session.stateVersion += 1;
  }

  const payload: ControllerStateMessage = {
    roomId,
    state: {
      runtimeState: session.runtimeState,
      orientation: session.controllerOrientation,
      stateVersion: session.stateVersion,
      ...(message !== undefined ? { message } : {}),
    },
  };
  io.to(roomId).emit("server:state", payload);
  return payload;
};

export const buildRoomStateMessage = (
  roomId: RoomCode,
  session: RoomSession,
  { message }: RoomStateMessageOverrides = {},
): ControllerStateMessage => ({
  roomId,
  state: {
    runtimeState: session.runtimeState,
    orientation: session.controllerOrientation,
    stateVersion: session.stateVersion,
    ...(message !== undefined ? { message } : {}),
  },
});

export const resyncPlayersToMasterHost = (
  io: AirJamIoServer,
  session: RoomSession,
): void => {
  const masterSocket = io.sockets.sockets.get(session.masterHostSocketId);
  if (!masterSocket) {
    return;
  }

  setTimeout(() => {
    session.controllers.forEach((controller) => {
      masterSocket.emit(
        "server:controllerJoined",
        toControllerJoinedNotice(controller),
      );
    });
  }, 100);
};

export const disconnectChildHostIfPresent = (
  io: AirJamIoServer,
  session: RoomSession,
): void => {
  if (!session.childHostSocketId) {
    return;
  }

  const childSocket = io.sockets.sockets.get(session.childHostSocketId);
  if (childSocket) {
    childSocket.disconnect(true);
  }
};

export const transitionToSystemFocus = (
  io: AirJamIoServer,
  session: RoomSession,
  options: TransitionToSystemFocusOptions = {},
): void => {
  if (session.pendingChildTeardownTimer) {
    clearTimeout(session.pendingChildTeardownTimer);
    session.pendingChildTeardownTimer = undefined;
  }

  beginRoomClosing(session);
  resetRoomToSystemState(session, options.resetGameState);

  if (options.notifyMasterCloseChild && session.masterHostSocketId) {
    io.to(session.masterHostSocketId).emit("server:closeChild");
  }

  if (options.resyncPlayersToMaster) {
    resyncPlayersToMasterHost(io, session);
  }
};
