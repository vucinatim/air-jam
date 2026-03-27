import {
  AIRJAM_DEV_LOG_EVENTS,
  controllerInputSchema,
  controllerJoinSchema,
  controllerLeaveSchema,
  controllerSystemSchema,
  controllerUpdatePlayerProfileSchema,
  ErrorCode,
  type AirJamDevLogEventName,
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
import { createWindowedEventSummary } from "../../logging/create-windowed-event-summary.js";
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
  const {
    io,
    socket,
    roomManager,
    isControllerAuthorizedForRoom,
    emitError,
  } = context;
  const logger = context.logger.child({ component: "controller" });
  let lastServerInputFailLogTime = 0;
  const controllerInputSummary = createWindowedEventSummary({
    logger,
    event: AIRJAM_DEV_LOG_EVENTS.controller.inputSummary,
    msg: "Controller input activity summary",
    shouldEmit: (next, previous) => {
      const nextInputCount =
        typeof next.data.inputCount === "number" ? next.data.inputCount : 0;
      const nextActiveInputCount =
        typeof next.data.activeInputCount === "number"
          ? next.data.activeInputCount
          : 0;
      if (nextActiveInputCount > 0 || !previous) {
        return true;
      }

      const previousInputCount =
        typeof previous.data.inputCount === "number"
          ? previous.data.inputCount
          : 0;
      const previousActiveInputCount =
        typeof previous.data.activeInputCount === "number"
          ? previous.data.activeInputCount
          : 0;

      if (previousActiveInputCount > 0) {
        return true;
      }

      return Math.abs(nextInputCount - previousInputCount) > 2;
    },
  });

  const getControllerLogger = (bindings: Record<string, unknown> = {}) => {
    const authority = socket.data.controllerAuthority;
    const mergedBindings = {
      ...(authority
        ? {
            roomId: authority.roomId,
            controllerId: authority.controllerId,
          }
        : {}),
      ...bindings,
    };

    return Object.keys(mergedBindings).length > 0
      ? logger.child(mergedBindings)
      : logger;
  };

  const logControllerEvent = (
    level: "debug" | "info" | "warn",
    event: AirJamDevLogEventName,
    msg: string,
    bindings: Record<string, unknown> = {},
  ): void => {
    const target = getControllerLogger(bindings);
    if (level === "debug") {
      target.debug({ event }, msg);
      return;
    }
    if (level === "warn") {
      target.warn({ event }, msg);
      return;
    }
    target.info({ event }, msg);
  };

  socket.on("disconnect", () => {
    controllerInputSummary.flushAll();
  });

  socket.on("controller:join", (payload: ControllerJoinPayload, callback) => {
    if (
      context.isRateLimited(
        "controller-join",
        context.controllerJoinRateLimitMax,
      )
    ) {
      logControllerEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.joinRejected,
        "Rejected controller join due to socket rate limit",
        { reason: "rate_limited" },
      );
      callback({
        ok: false,
        message: "Too many join attempts. Please try again.",
        code: ErrorCode.SERVICE_UNAVAILABLE,
      });
      return;
    }

    const parsed = controllerJoinSchema.safeParse(payload);
    if (!parsed.success) {
      logControllerEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.joinRejected,
        "Rejected controller join with invalid payload",
        {
          reason: "invalid_payload",
          issues: parsed.error.issues,
        },
      );
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
      logControllerEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.joinRejected,
        "Rejected controller join because room was not found",
        {
          roomId,
          controllerId,
          reason: "room_not_found",
        },
      );
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
      logControllerEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.joinRejected,
        "Rejected controller join because room is full",
        {
          roomId,
          controllerId,
          reason: "room_full",
          maxPlayers: session.maxPlayers,
        },
      );
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
    socket.data.controllerAuthority = {
      roomId,
      controllerId,
      joinedAt: Date.now(),
    };
    socket.join(roomId);

    io.to(roomManager.getActiveHostId(session)).emit(
      "server:controllerJoined",
      toControllerJoinedNotice(controllerSession),
    );

    logControllerEvent("info", AIRJAM_DEV_LOG_EVENTS.controller.joinAccepted, "Controller joined room", {
      roomId,
      controllerId,
      nickname: nickname ?? undefined,
    });

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
        logControllerEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.controller.profileUpdateRejected,
          "Rejected controller profile update with invalid payload",
          {
            reason: "invalid_payload",
            issues: parsed.error.issues,
          },
        );
        respond({
          ok: false,
          message: parsed.error.message,
        });
        return;
      }

      const { roomId, controllerId, patch } = parsed.data;
      if (!isControllerAuthorizedForRoom(roomId, controllerId)) {
        logControllerEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.controller.profileUpdateRejected,
          "Rejected controller profile update because socket is unauthorized",
          {
            roomId,
            controllerId,
            reason: "unauthorized",
          },
        );
        respond({
          ok: false,
          message: "Not authorized",
          code: ErrorCode.INVALID_PAYLOAD,
        });
        return;
      }

      const session = roomManager.getRoom(roomId);
      if (!session) {
        logControllerEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.controller.profileUpdateRejected,
          "Rejected controller profile update because room was not found",
          {
            roomId,
            controllerId,
            reason: "room_not_found",
          },
        );
        respond({
          ok: false,
          message: "Room not found",
          code: ErrorCode.ROOM_NOT_FOUND,
        });
        return;
      }

      const controllerSession = session.controllers.get(controllerId);
      if (!controllerSession) {
        logControllerEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.controller.profileUpdateRejected,
          "Rejected controller profile update because controller is not in room",
          {
            roomId,
            controllerId,
            reason: "controller_not_in_room",
          },
        );
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

      logControllerEvent(
        "info",
        AIRJAM_DEV_LOG_EVENTS.controller.profileUpdateAccepted,
        "Controller profile updated",
        {
          roomId,
          controllerId,
          patch: parsed.data.patch,
        },
      );

      respond({ ok: true, player: nextProfile });
    },
  );

  socket.on("controller:leave", (payload: ControllerLeavePayload) => {
    const parsed = controllerLeaveSchema.safeParse(payload);
    if (!parsed.success) {
      logControllerEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.leaveRejected,
        "Rejected controller leave with invalid payload",
        {
          reason: "invalid_payload",
          issues: parsed.error.issues,
        },
      );
      return;
    }

    const { roomId, controllerId } = parsed.data;
    if (!isControllerAuthorizedForRoom(roomId, controllerId)) {
      logControllerEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.leaveRejected,
        "Rejected controller leave because socket is unauthorized",
        {
          roomId,
          controllerId,
          reason: "unauthorized",
        },
      );
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      logControllerEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.leaveRejected,
        "Rejected controller leave because room was not found",
        {
          roomId,
          controllerId,
          reason: "room_not_found",
        },
      );
      return;
    }

    session.controllers.delete(controllerId);
    roomManager.deleteController(socket.id);
    delete socket.data.controllerAuthority;
    io.to(roomManager.getActiveHostId(session)).emit("server:controllerLeft", {
      controllerId,
    });
    socket.leave(roomId);
    logControllerEvent("info", AIRJAM_DEV_LOG_EVENTS.controller.leaveAccepted, "Controller left room", {
      roomId,
      controllerId,
    });
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

    const result = controllerInputSchema.safeParse(payload);
    if (!result.success) {
      if (
        !lastServerInputFailLogTime ||
        now - lastServerInputFailLogTime > 1000
      ) {
        lastServerInputFailLogTime = now;
        logControllerEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.controller.inputRejected,
          "Rejected controller input with invalid payload",
          {
            reason: "invalid_payload",
            issues: result.error.issues,
          },
        );
      }
      return;
    }

    const { roomId, controllerId } = result.data;
    if (!isControllerAuthorizedForRoom(roomId, controllerId)) {
      if (
        !lastServerInputFailLogTime ||
        now - lastServerInputFailLogTime > 1000
      ) {
        lastServerInputFailLogTime = now;
        logControllerEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.controller.inputRejected,
          "Rejected controller input because socket is unauthorized",
          {
            roomId,
            controllerId,
            reason: "unauthorized",
          },
        );
      }
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      if (
        !lastServerInputFailLogTime ||
        now - lastServerInputFailLogTime > 1000
      ) {
        lastServerInputFailLogTime = now;
        logControllerEvent(
          "warn",
          AIRJAM_DEV_LOG_EVENTS.controller.inputRejected,
          "Rejected controller input because room was not found",
          {
            roomId,
            controllerId,
            reason: "room_not_found",
          },
        );
      }
      return;
    }

    const targetHostId = roomManager.getActiveHostId(session);
    if (targetHostId) {
      io.to(targetHostId).emit("server:input", result.data);
      controllerInputSummary.record({
        key: `${roomId}:${controllerId}`,
        bindings: {
          roomId,
          controllerId,
        },
        metrics: {
          inputCount: 1,
          activeInputCount: hasActiveInput ? 1 : 0,
        },
      });
    } else if (
      !lastServerInputFailLogTime ||
      now - lastServerInputFailLogTime > 1000
    ) {
      lastServerInputFailLogTime = now;
      logControllerEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.inputRejected,
        "Rejected controller input because no active host was available",
        {
          roomId,
          controllerId,
          reason: "active_host_missing",
        },
      );
    }
  });

  socket.on("controller:system", (payload) => {
    const parsed = controllerSystemSchema.safeParse(payload);
    if (!parsed.success) {
      logControllerEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.systemRejected,
        "Rejected controller system command with invalid payload",
        {
          reason: "invalid_payload",
          issues: parsed.error.issues,
        },
      );
      return;
    }

    const { roomId, command } = parsed.data;
    if (!isControllerAuthorizedForRoom(roomId)) {
      logControllerEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.systemRejected,
        "Rejected controller system command because socket is unauthorized",
        {
          roomId,
          reason: "unauthorized",
          command,
        },
      );
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      logControllerEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.systemRejected,
        "Rejected controller system command because room was not found",
        {
          roomId,
          reason: "room_not_found",
          command,
        },
      );
      return;
    }

    if (command === "exit") {
      logControllerEvent("info", AIRJAM_DEV_LOG_EVENTS.controller.systemAccepted, "Controller requested room exit", {
        roomId,
        command,
      });
      beginRoomClosing(session);
      disconnectChildHostIfPresent(io, session);
      transitionToSystemFocus(io, session, {
        resetGameState: true,
        notifyMasterCloseChild: true,
      });
      return;
    }

    if (command === "toggle_pause") {
      logControllerEvent("info", AIRJAM_DEV_LOG_EVENTS.controller.systemAccepted, "Controller toggled pause state", {
        roomId,
        command,
      });
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
