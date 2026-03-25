import {
  controllerActionRpcSchema,
  controllerStateSchema,
  controllerSystemSchema,
  hostStateSyncSchema,
  type AirJamActionRpcPayload,
  type AirJamStateSyncPayload,
  type ControllerActionRpcPayload,
  type ControllerStateMessage,
  type PlaySoundEventPayload,
  type SignalPayload,
  isAirJamArcadePlatformPrefixAction,
} from "@air-jam/sdk/protocol";
import { emitRoomState } from "../../domain/room-session-domain.js";
import type { SocketHandlerContext } from "../socket-handler-context.js";

export const registerRealtimeHandlers = (
  context: SocketHandlerContext,
): void => {
  const {
    io,
    socket,
    roomManager,
    isHostAuthorizedForRoom,
    isControllerAuthorizedForRoom,
  } = context;

  socket.on("host:system", (payload) => {
    const parsed = controllerSystemSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    const { roomId, command } = parsed.data;
    if (!isHostAuthorizedForRoom(roomId)) {
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
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

  socket.on("host:state", (payload: ControllerStateMessage) => {
    const result = controllerStateSchema.safeParse(payload);
    if (!result.success) {
      return;
    }

    const { roomId, state } = result.data;
    if (!isHostAuthorizedForRoom(roomId)) {
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      return;
    }

    if (state.gameState) {
      session.gameState = state.gameState;
    }
    if (state.orientation) {
      session.controllerOrientation = state.orientation;
    }

    session.controllers.forEach((controller) => {
      io.to(controller.socketId).emit("server:state", result.data);
    });

    if (session.masterHostSocketId) {
      io.to(session.masterHostSocketId).emit("server:state", result.data);
    }
    if (session.childHostSocketId) {
      io.to(session.childHostSocketId).emit("server:state", result.data);
    }
  });

  socket.on("host:signal", (payload: SignalPayload) => {
    const roomId = roomManager.getRoomByHostId(socket.id);
    if (!roomId) {
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      return;
    }

    if (payload.targetId) {
      const controller = session.controllers.get(payload.targetId);
      if (controller) {
        io.to(controller.socketId).emit("server:signal", payload);
      }
      return;
    }

    socket.to(roomId).emit("server:signal", payload);
  });

  socket.on("host:play_sound", (payload: PlaySoundEventPayload) => {
    const { roomId, targetControllerId, soundId, volume, loop } = payload;
    if (!isHostAuthorizedForRoom(roomId)) {
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      return;
    }

    const message = { id: soundId, volume, loop };
    if (targetControllerId) {
      const controller = session.controllers.get(targetControllerId);
      if (controller) {
        io.to(controller.socketId).emit("server:playSound", message);
      }
      return;
    }

    socket.to(roomId).emit("server:playSound", message);
  });

  socket.on("controller:play_sound", (payload: PlaySoundEventPayload) => {
    const { roomId, soundId, volume, loop } = payload;
    if (!isControllerAuthorizedForRoom(roomId)) {
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
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
      return;
    }

    const { roomId, data, storeDomain } = parsed.data;
    const session = roomManager.getRoom(roomId);
    if (!session) {
      return;
    }

    if (
      session.masterHostSocketId !== socket.id &&
      session.childHostSocketId !== socket.id
    ) {
      return;
    }

    const syncPayload: AirJamStateSyncPayload = { roomId, data, storeDomain };
    io.to(roomId).emit("airjam:state_sync", syncPayload);
  });

  socket.on("controller:action_rpc", (payload: ControllerActionRpcPayload) => {
    const parsed = controllerActionRpcSchema.safeParse(payload);
    if (!parsed.success) {
      return;
    }

    const { roomId, actionName, payload: actionPayload, storeDomain } =
      parsed.data;
    if (actionName.startsWith("_")) {
      return;
    }

    if (!isControllerAuthorizedForRoom(roomId)) {
      return;
    }

    const session = roomManager.getRoom(roomId);
    if (!session) {
      return;
    }

    const controllerInfo = roomManager.getControllerInfo(socket.id);
    if (!controllerInfo || controllerInfo.roomId !== roomId) {
      return;
    }

    const controllerId = controllerInfo.controllerId;
    const controllerSession = session.controllers.get(controllerId);
    if (!controllerSession) {
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
    }
  });
};
