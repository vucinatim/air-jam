import {
  AIRJAM_DEV_LOG_EVENTS,
  controllerActionRpcSchema,
  controllerStateSyncRequestSchema,
  controllerStateSchema,
  controllerSystemSchema,
  hostStateSyncSchema,
  type AirJamDevLogEventName,
  type AirJamActionRpcPayload,
  type AirJamStateSyncPayload,
  type ControllerActionRpcPayload,
  type ControllerStateMessage,
  type PlaySoundEventPayload,
  type SignalPayload,
  isAirJamArcadePlatformPrefixAction,
} from "@air-jam/sdk/protocol";
import { emitRoomState } from "../../domain/room-session-domain.js";
import { createWindowedEventSummary } from "../../logging/create-windowed-event-summary.js";
import type { SocketHandlerContext } from "../socket-handler-context.js";

export const registerRealtimeHandlers = (
  context: SocketHandlerContext,
): void => {
  const logger = context.logger.child({ component: "realtime" });
  const {
    io,
    socket,
    roomManager,
    isHostAuthorizedForRoom,
    isControllerAuthorizedForRoom,
    hasControllerPrivilegeForRoom,
  } = context;
  const hostStateSyncSummary = createWindowedEventSummary({
    logger,
    event: AIRJAM_DEV_LOG_EVENTS.host.stateSyncSummary,
    msg: "Host state sync activity summary",
  });
  const controllerActionRpcSummary = createWindowedEventSummary({
    logger,
    event: AIRJAM_DEV_LOG_EVENTS.controller.actionRpcSummary,
    msg: "Controller action RPC activity summary",
  });
  const hostStateBroadcastSummary = createWindowedEventSummary({
    logger,
    event: AIRJAM_DEV_LOG_EVENTS.host.stateBroadcastSummary,
    msg: "Host state broadcast summary",
  });

  const getRealtimeLogger = (bindings: Record<string, unknown> = {}) => {
    const mergedBindings = {
      ...(socket.data.hostAuthority?.traceId
        ? { traceId: socket.data.hostAuthority.traceId }
        : {}),
      ...(socket.data.controllerAuthority
        ? {
            roomId: socket.data.controllerAuthority.roomId,
            controllerId: socket.data.controllerAuthority.controllerId,
          }
        : {}),
      ...bindings,
    };

    return Object.keys(mergedBindings).length > 0
      ? logger.child(mergedBindings)
      : logger;
  };

  const logRealtimeEvent = (
    level: "debug" | "info" | "warn",
    event: AirJamDevLogEventName,
    msg: string,
    bindings: Record<string, unknown> = {},
  ): void => {
    const target = getRealtimeLogger(bindings);
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
    hostStateSyncSummary.flushAll();
    controllerActionRpcSummary.flushAll();
    hostStateBroadcastSummary.flushAll();
  });

  socket.on("host:system", (payload) => {
    const parsed = controllerSystemSchema.safeParse(payload);
    if (!parsed.success) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.systemRejected, "Rejected host system command with invalid payload", {
        reason: "invalid_payload",
        issues: parsed.error.issues,
      });
      return;
    }

    const { roomId, command } = parsed.data;
    if (!isHostAuthorizedForRoom(roomId)) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.systemRejected, "Rejected host system command because socket is unauthorized", {
        roomId,
        command,
        reason: "unauthorized",
      });
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.systemRejected, "Rejected host system command because room was not found", {
        roomId,
        command,
        reason: "room_not_found",
      });
      return;
    }

    if (command === "toggle_pause") {
      const previousGameState = session.runtimeState;
      const nextGameState =
        previousGameState === "playing" ? "paused" : "playing";
      session.runtimeState = nextGameState;
      const broadcastPayload = emitRoomState(io, roomId, session);
      logRealtimeEvent("info", AIRJAM_DEV_LOG_EVENTS.host.systemAccepted, "Host toggled pause state", {
        roomId,
        command,
        previousGameState,
        nextGameState,
        stateVersion: broadcastPayload.state.stateVersion,
      });
      hostStateBroadcastSummary.record({
        key: `${roomId}:host_system_toggle`,
        bindings: { roomId },
        data: {
          source: "host_system_toggle",
          latestStateVersion: broadcastPayload.state.stateVersion ?? 0,
        },
        metrics: {
          broadcastCount: 1,
        },
      });
      return;
    }

    logRealtimeEvent(
      "warn",
      AIRJAM_DEV_LOG_EVENTS.host.systemRejected,
      "Rejected host system command because command is unsupported",
      {
        roomId,
        command,
        reason: "unsupported_command",
      },
    );
  });

  socket.on("host:state", (payload: ControllerStateMessage) => {
    const result = controllerStateSchema.safeParse(payload);
    if (!result.success) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.stateRejected, "Rejected host state update with invalid payload", {
        reason: "invalid_payload",
        issues: result.error.issues,
      });
      return;
    }

    const { roomId, state } = result.data;
    if (!isHostAuthorizedForRoom(roomId)) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.stateRejected, "Rejected host state update because socket is unauthorized", {
        roomId,
        reason: "unauthorized",
      });
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.stateRejected, "Rejected host state update because room was not found", {
        roomId,
        reason: "room_not_found",
      });
      return;
    }

    const previousGameState = session.runtimeState;
    const previousOrientation = session.controllerOrientation;
    if (state.runtimeState) {
      session.runtimeState = state.runtimeState;
    }
    if (state.orientation) {
      session.controllerOrientation = state.orientation;
    }
    const broadcastPayload = emitRoomState(io, roomId, session, {
      message: state.message,
    });
    hostStateBroadcastSummary.record({
      key: `${roomId}:host_state`,
      bindings: { roomId },
      data: {
        source: "host_state",
        hasMessage: state.message !== undefined,
        gameStateChanged: previousGameState !== session.runtimeState,
        orientationChanged: previousOrientation !== session.controllerOrientation,
        latestStateVersion: broadcastPayload.state.stateVersion ?? 0,
      },
      metrics: {
        broadcastCount: 1,
      },
    });
  });

  socket.on("host:signal", (payload: SignalPayload) => {
    const roomId = roomManager.getRoomByHostId(socket.id);
    if (!roomId) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.signalRejected, "Rejected host signal because socket is not bound to a room", {
        reason: "room_binding_missing",
        signalType: payload.type,
      });
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.signalRejected, "Rejected host signal because room was not found", {
        roomId,
        reason: "room_not_found",
        signalType: payload.type,
      });
      return;
    }

    if (payload.targetId) {
      const controller = session.controllers.get(payload.targetId);
      if (controller?.socketId) {
        io.to(controller.socketId).emit("server:signal", payload);
        return;
      }
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.signalRejected, "Rejected host signal because target controller was not found", {
        roomId,
        targetControllerId: payload.targetId,
        reason: "target_missing",
        signalType: payload.type,
      });
      return;
    }

    socket.to(roomId).emit("server:signal", payload);
  });

  socket.on("host:play_sound", (payload: PlaySoundEventPayload) => {
    const { roomId, targetControllerId, soundId, volume, loop } = payload;
    if (!isHostAuthorizedForRoom(roomId)) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.playSoundRejected, "Rejected host sound playback because socket is unauthorized", {
        roomId,
        soundId,
        reason: "unauthorized",
      });
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.playSoundRejected, "Rejected host sound playback because room was not found", {
        roomId,
        soundId,
        reason: "room_not_found",
      });
      return;
    }

    const message = { id: soundId, volume, loop };
    if (targetControllerId) {
      const controller = session.controllers.get(targetControllerId);
      if (controller?.socketId) {
        io.to(controller.socketId).emit("server:playSound", message);
        return;
      }
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.playSoundRejected, "Rejected host targeted sound because controller was not found", {
        roomId,
        targetControllerId,
        soundId,
        reason: "target_missing",
      });
      return;
    }

    socket.to(roomId).emit("server:playSound", message);
  });

  socket.on("controller:play_sound", (payload: PlaySoundEventPayload) => {
    const { roomId, soundId, volume, loop } = payload;
    if (!isControllerAuthorizedForRoom(roomId)) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.controller.playSoundRejected, "Rejected controller sound playback because socket is unauthorized", {
        roomId,
        soundId,
        reason: "unauthorized",
      });
      return;
    }

    if (!hasControllerPrivilegeForRoom(roomId, "play_sound")) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.controller.playSoundRejected, "Rejected controller sound playback because privileged capability is missing", {
        roomId,
        soundId,
        reason: "missing_capability",
      });
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.controller.playSoundRejected, "Rejected controller sound playback because room was not found", {
        roomId,
        soundId,
        reason: "room_not_found",
      });
      return;
    }

    io.to(roomManager.getActiveHostId(session)).emit("server:playSound", {
      id: soundId,
      volume,
      loop,
    });
  });

  socket.on("host:state_sync", (payload: unknown) => {
    const parsed = hostStateSyncSchema.safeParse(payload);
    if (!parsed.success) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.stateSyncRejected, "Rejected host state sync with invalid payload", {
        reason: "invalid_payload",
        issues: parsed.error.issues,
      });
      return;
    }

    const { roomId, data, storeDomain } = parsed.data;
    const session = roomManager.getRoom(roomId);
    if (!session) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.stateSyncRejected, "Rejected host state sync because room was not found", {
        roomId,
        storeDomain,
        reason: "room_not_found",
      });
      return;
    }

    if (
      session.masterHostSocketId !== socket.id &&
      session.childHostSocketId !== socket.id
    ) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.host.stateSyncRejected, "Rejected host state sync because socket is unauthorized", {
        roomId,
        storeDomain,
        reason: "unauthorized",
      });
      return;
    }

    const syncPayload: AirJamStateSyncPayload = { roomId, data, storeDomain };
    io.to(roomId).emit("airjam:state_sync", syncPayload);
    hostStateSyncSummary.record({
      key: `${roomId}:${storeDomain}`,
      bindings: { roomId },
      data: { storeDomain },
      metrics: { syncCount: 1 },
    });
  });

  socket.on("controller:state_sync_request", (payload: unknown) => {
    const parsed = controllerStateSyncRequestSchema.safeParse(payload);
    if (!parsed.success) {
      logRealtimeEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.actionRpcRejected,
        "Rejected controller state sync request with invalid payload",
        {
          reason: "invalid_payload",
          issues: parsed.error.issues,
        },
      );
      return;
    }

    const { roomId, storeDomain } = parsed.data;
    if (!isControllerAuthorizedForRoom(roomId)) {
      logRealtimeEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.actionRpcRejected,
        "Rejected controller state sync request because socket is unauthorized",
        {
          roomId,
          storeDomain,
          reason: "unauthorized",
        },
      );
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      logRealtimeEvent(
        "warn",
        AIRJAM_DEV_LOG_EVENTS.controller.actionRpcRejected,
        "Rejected controller state sync request because room was not found",
        {
          roomId,
          storeDomain,
          reason: "room_not_found",
        },
      );
      return;
    }

    io.to(roomManager.getActiveHostId(session)).emit("airjam:state_sync_request", {
      roomId,
      storeDomain,
    });
  });

  socket.on("controller:action_rpc", (payload: ControllerActionRpcPayload) => {
    const parsed = controllerActionRpcSchema.safeParse(payload);
    if (!parsed.success) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.controller.actionRpcRejected, "Rejected controller action RPC with invalid payload", {
        reason: "invalid_payload",
        issues: parsed.error.issues,
      });
      return;
    }

    const { roomId, actionName, payload: actionPayload, storeDomain } =
      parsed.data;
    if (actionName.startsWith("_")) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.controller.actionRpcRejected, "Rejected controller action RPC because action name is reserved", {
        roomId,
        actionName,
        storeDomain,
        reason: "reserved_action",
      });
      return;
    }

    if (!isControllerAuthorizedForRoom(roomId)) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.controller.actionRpcRejected, "Rejected controller action RPC because socket is unauthorized", {
        roomId,
        actionName,
        storeDomain,
        reason: "unauthorized",
      });
      return;
    }

    if (!hasControllerPrivilegeForRoom(roomId, "action_rpc")) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.controller.actionRpcRejected, "Rejected controller action RPC because privileged capability is missing", {
        roomId,
        actionName,
        storeDomain,
        reason: "missing_capability",
      });
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.controller.actionRpcRejected, "Rejected controller action RPC because room was not found", {
        roomId,
        actionName,
        storeDomain,
        reason: "room_not_found",
      });
      return;
    }

    const controllerInfo = roomManager.getControllerInfo(socket.id);
    if (!controllerInfo || controllerInfo.roomId !== roomId) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.controller.actionRpcRejected, "Rejected controller action RPC because controller mapping was missing", {
        roomId,
        actionName,
        storeDomain,
        reason: "controller_mapping_missing",
      });
      return;
    }

    const controllerId = controllerInfo.controllerId;
    const controllerSession = session.controllers.get(controllerId);
    if (!controllerSession) {
      logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.controller.actionRpcRejected, "Rejected controller action RPC because controller session was not found", {
        roomId,
        controllerId,
        actionName,
        storeDomain,
        reason: "controller_session_missing",
      });
      return;
    }

    const shouldRouteToMaster = isAirJamArcadePlatformPrefixAction(actionName);
    const hostId = shouldRouteToMaster
      ? session.masterHostSocketId
      : roomManager.getActiveHostId(session);
    if (hostId) {
      const rpcPayload: AirJamActionRpcPayload = {
        actionName,
        payload: actionPayload,
        storeDomain,
        actor: {
          id: controllerId,
          role: "controller",
        },
      };
      io.to(hostId).emit("airjam:action_rpc", rpcPayload);
      controllerActionRpcSummary.record({
        key: `${roomId}:${controllerId}:${storeDomain}:${actionName}:${shouldRouteToMaster ? "master" : "active"}`,
        bindings: {
          roomId,
          controllerId,
        },
        data: {
          actionName,
          storeDomain,
          target:
            shouldRouteToMaster ? "master_host" : "active_host",
        },
        metrics: {
          rpcCount: 1,
        },
      });
      return;
    }

    logRealtimeEvent("warn", AIRJAM_DEV_LOG_EVENTS.controller.actionRpcRejected, "Rejected controller action RPC because no host target was available", {
      roomId,
      controllerId,
      actionName,
      storeDomain,
      reason: "host_target_missing",
    });
  });
};
