import {
  controllerInputSchema,
  controllerJoinSchema,
  controllerLeaveSchema,
  controllerSystemSchema,
  controllerUpdatePlayerProfileSchema,
  ErrorCode,
  type ControllerInputEvent,
  type ControllerJoinPayload,
  type ControllerLeavePayload,
  type ControllerUpdatePlayerProfileAck,
  type PlayerProfile,
} from "@air-jam/sdk/protocol";
import Color from "color";
import {
  beginRoomClosing,
  disconnectChildHostIfPresent,
  emitRoomState,
  toControllerJoinedNotice,
  transitionToSystemFocus,
} from "../../domain/room-session-domain.js";
import type { ControllerSession } from "../../types.js";
import type { SocketHandlerContext } from "../socket-handler-context.js";

const PLAYER_COLORS = [
  "#38bdf8",
  "#a78bfa",
  "#f472b6",
  "#34d399",
  "#fbbf24",
  "#60a5fa",
  "#c084fc",
  "#fb7185",
  "#4ade80",
  "#f87171",
  "#22d3ee",
  "#a855f7",
  "#ec4899",
  "#10b981",
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
  "#f97316",
] as const;

export const registerControllerHandlers = (
  context: SocketHandlerContext,
): void => {
  const { io, socket, roomManager, isControllerAuthorizedForRoom, emitError } =
    context;
  let lastServerInputLogTime = 0;
  let lastServerInputFailLogTime = 0;

  socket.on("controller:join", (payload: ControllerJoinPayload, callback) => {
    if (
      context.isRateLimited(
        "controller-join",
        context.controllerJoinRateLimitMax,
      )
    ) {
      callback({
        ok: false,
        message: "Too many join attempts. Please try again.",
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
      return;
    }

    const parsed = controllerJoinSchema.safeParse(payload);
    if (!parsed.success) {
      callback({
        ok: false,
        message: parsed.error.message,
        code: ErrorCode.INVALID_PAYLOAD,
      });
      return;
    }

    const { roomId, controllerId, nickname, avatarId } = parsed.data;
    const session = roomManager.getRoom(roomId);
    if (!session) {
      callback({
        ok: false,
        message: "Room not found",
        code: ErrorCode.ROOM_NOT_FOUND,
      });
      emitError(socket.id, {
        code: ErrorCode.ROOM_NOT_FOUND,
        message: "Room not found",
      });
      return;
    }

    const previousController = roomManager.getControllerInfo(socket.id);
    if (
      previousController &&
      (previousController.roomId !== roomId ||
        previousController.controllerId !== controllerId)
    ) {
      const previousSession = roomManager.getRoom(previousController.roomId);
      const previousEntry = previousSession?.controllers.get(
        previousController.controllerId,
      );
      if (previousSession && previousEntry?.socketId === socket.id) {
        previousSession.controllers.delete(previousController.controllerId);
        io.to(roomManager.getActiveHostId(previousSession)).emit(
          "server:controllerLeft",
          {
            controllerId: previousController.controllerId,
          },
        );
      }
      roomManager.deleteController(socket.id);
    }

    if (session.controllers.size >= session.maxPlayers) {
      callback({
        ok: false,
        message: "Room full",
        code: ErrorCode.ROOM_FULL,
      });
      emitError(socket.id, {
        code: ErrorCode.ROOM_FULL,
        message: "Room is full",
      });
      return;
    }

    const existing = session.controllers.get(controllerId);
    if (existing) {
      roomManager.deleteController(existing.socketId);
    }

    const colorHex =
      PLAYER_COLORS[session.controllers.size % PLAYER_COLORS.length];
    let color: string;
    try {
      color = Color(colorHex).hex();
    } catch {
      color = Color("#38bdf8").hex();
    }

    const playerProfile: PlayerProfile = {
      id: controllerId,
      label: nickname ?? `Player ${session.controllers.size}`,
      color,
      ...(avatarId ? { avatarId } : {}),
    };

    const controllerSession: ControllerSession = {
      controllerId,
      nickname,
      socketId: socket.id,
      playerProfile,
    };

    session.controllers.set(controllerId, controllerSession);
    roomManager.setController(socket.id, { roomId, controllerId });
    socket.join(roomId);

    io.to(roomManager.getActiveHostId(session)).emit(
      "server:controllerJoined",
      toControllerJoinedNotice(controllerSession),
    );

    callback({ ok: true, controllerId, roomId });
    socket.emit("server:welcome", {
      controllerId,
      roomId,
      player: playerProfile,
    });
    socket.emit("server:state", {
      roomId,
      state: {
        gameState: session.gameState,
        orientation: session.controllerOrientation,
      },
    });
  });

  socket.on(
    "controller:updatePlayerProfile",
    (
      payload: unknown,
      callback: (ack: ControllerUpdatePlayerProfileAck) => void,
    ) => {
      const respond = (ack: ControllerUpdatePlayerProfileAck): void => {
        callback?.(ack);
      };

      const parsed = controllerUpdatePlayerProfileSchema.safeParse(payload);
      if (!parsed.success) {
        respond({
          ok: false,
          message: parsed.error.message,
        });
        return;
      }

      const { roomId, controllerId, patch } = parsed.data;
      if (!isControllerAuthorizedForRoom(roomId, controllerId)) {
        respond({
          ok: false,
          message: "Not authorized",
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const session = roomManager.getRoom(roomId);
      if (!session) {
        respond({
          ok: false,
          message: "Room not found",
          code: ErrorCode.ROOM_NOT_FOUND,
        });
        return;
      }

      const controllerSession = session.controllers.get(controllerId);
      if (!controllerSession) {
        respond({
          ok: false,
          message: "Controller not in room",
        });
        return;
      }

      const nextProfile: PlayerProfile = {
        ...controllerSession.playerProfile,
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.avatarId !== undefined ? { avatarId: patch.avatarId } : {}),
      };

      controllerSession.playerProfile = nextProfile;
      if (patch.label !== undefined) {
        controllerSession.nickname = patch.label;
      }

      const notice = { player: nextProfile };

      io.to(roomManager.getActiveHostId(session)).emit(
        "server:playerUpdated",
        notice,
      );
      socket.emit("server:playerUpdated", notice);

      respond({ ok: true, player: nextProfile });
    },
  );

  socket.on("controller:leave", (payload: ControllerLeavePayload) => {
    const parsed = controllerLeaveSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    const { roomId, controllerId } = parsed.data;
    if (!isControllerAuthorizedForRoom(roomId, controllerId)) {
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      return;
    }

    session.controllers.delete(controllerId);
    roomManager.deleteController(socket.id);
    io.to(roomManager.getActiveHostId(session)).emit("server:controllerLeft", {
      controllerId,
    });
    socket.leave(roomId);
  });

  socket.on("controller:input", (payload: ControllerInputEvent) => {
    const now = Date.now();
    const input = payload?.input;
    const hasActiveInput =
      input &&
      (input.action === true ||
        (typeof input.vector === "object" &&
          input.vector !== null &&
          (Math.abs((input.vector as { x?: number; y?: number }).x ?? 0) >
            0.01 ||
            Math.abs((input.vector as { x?: number; y?: number }).y ?? 0) >
              0.01)));

    if (
      hasActiveInput &&
      (!lastServerInputLogTime || now - lastServerInputLogTime > 1000)
    ) {
      lastServerInputLogTime = now;
    }

    const result = controllerInputSchema.safeParse(payload);
    if (!result.success) {
      if (
        !lastServerInputFailLogTime ||
        now - lastServerInputFailLogTime > 1000
      ) {
        lastServerInputFailLogTime = now;
      }
      return;
    }

    const { roomId, controllerId } = result.data;
    if (!isControllerAuthorizedForRoom(roomId, controllerId)) {
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      if (
        !lastServerInputFailLogTime ||
        now - lastServerInputFailLogTime > 1000
      ) {
        lastServerInputFailLogTime = now;
      }
      return;
    }

    const targetHostId = roomManager.getActiveHostId(session);
    if (targetHostId) {
      if (!lastServerInputLogTime || now - lastServerInputLogTime > 1000) {
        lastServerInputLogTime = now;
      }
      io.to(targetHostId).emit("server:input", result.data);
    } else if (
      !lastServerInputFailLogTime ||
      now - lastServerInputFailLogTime > 1000
    ) {
      lastServerInputFailLogTime = now;
    }
  });

  socket.on("controller:system", (payload) => {
    const parsed = controllerSystemSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    const { roomId, command } = parsed.data;
    if (!isControllerAuthorizedForRoom(roomId)) {
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      return;
    }

    if (command === "exit") {
      beginRoomClosing(session);
      disconnectChildHostIfPresent(io, session);
      transitionToSystemFocus(io, session, {
        resetGameState: true,
        notifyMasterCloseChild: true,
      });
      return;
    }

    if (command === "toggle_pause") {
      session.gameState =
        session.gameState === "playing" ? "paused" : "playing";
      emitRoomState(
        io,
        roomId,
        session.gameState,
        session.controllerOrientation,
      );
    }
  });
};
