import type {
  ControllerStateMessage,
  GameState,
  HostArcadeSessionSnapshot,
  RoomCode,
} from "@air-jam/sdk/protocol";
import type { Server } from "socket.io";
import type {
  ControllerSession,
  RoomLifecycleState,
  RoomSession,
} from "../types.js";

type ControllerOrientation = NonNullable<
  ControllerStateMessage["state"]["orientation"]
>;

type AirJamIoServer = Server;

export interface TransitionToSystemFocusOptions {
  resetGameState?: boolean;
  notifyMasterCloseChild?: boolean;
  resyncPlayersToMaster?: boolean;
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
  joinToken: string,
  gameId: string,
): void => {
  session.joinToken = joinToken;
  session.activeGameId = gameId;
};

export const beginGameLaunch = (
  session: RoomSession,
  joinToken: string,
  gameId: string,
): LaunchAvailability => {
  const launchAvailability = canBeginGameLaunch(session);
  if (!launchAvailability.ok) {
    return launchAvailability;
  }

  transitionRoomLifecycle(session, "GAME_LAUNCH_PENDING");
  startGameLaunch(session, joinToken, gameId);
  return { ok: true };
};

/**
 * Snapshot for host `host:reconnect` ack so the client can restore arcade UI after refresh.
 */
export const buildArcadeSessionForHostAck = (
  session: RoomSession,
): HostArcadeSessionSnapshot | undefined => {
  if (!session.joinToken || !session.activeGameId) {
    return undefined;
  }
  const phase = session.lifecycleState;
  if (phase !== "GAME_ACTIVE" && phase !== "GAME_LAUNCH_PENDING") {
    return undefined;
  }
  return {
    gameId: session.activeGameId,
    joinToken: session.joinToken,
  };
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
  session.joinToken = undefined;
  session.activeGameId = undefined;
  transitionRoomLifecycle(session, "SYSTEM_IDLE");
  if (resetGameState) {
    session.gameState = "paused";
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

export const toControllerJoinedNotice = (controller: ControllerSession) => ({
  controllerId: controller.controllerId,
  nickname: controller.nickname,
  player: controller.playerProfile,
});

export const emitRoomState = (
  io: AirJamIoServer,
  roomId: RoomCode,
  gameState: GameState,
  controllerOrientation: ControllerOrientation,
): void => {
  io.to(roomId).emit("server:state", {
    roomId,
    state: { gameState, orientation: controllerOrientation },
  });
};

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
