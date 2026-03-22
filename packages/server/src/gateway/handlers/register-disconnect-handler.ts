import {
  beginRoomClosing,
  transitionToSystemFocus,
} from "../../domain/room-session-domain.js";
import type { SocketHandlerContext } from "../socket-handler-context.js";

export const registerDisconnectHandler = (
  context: SocketHandlerContext,
): void => {
  const { io, socket, roomManager } = context;

  socket.on("disconnect", () => {
    const roomId = roomManager.getRoomByHostId(socket.id);
    if (roomId) {
      const session = roomManager.getRoom(roomId);
      if (!session) {
        roomManager.deleteHost(socket.id);
        return;
      }

      if (socket.id === session.childHostSocketId) {
        beginRoomClosing(session);
        transitionToSystemFocus(io, roomId, session, {
          resyncPlayersToMaster: true,
        });
      } else if (socket.id === session.masterHostSocketId) {
        setTimeout(() => {
          const currentSession = roomManager.getRoom(roomId);
          if (currentSession && currentSession.masterHostSocketId === socket.id) {
            roomManager.removeRoom(roomId, io, "Host disconnected");
          }
        }, 3000);
      }

      roomManager.deleteHost(socket.id);
      return;
    }

    const controller = roomManager.getControllerInfo(socket.id);
    if (!controller) {
      return;
    }

    const session = roomManager.getRoom(controller.roomId);
    if (session) {
      session.controllers.delete(controller.controllerId);
      io.to(roomManager.getActiveHostId(session)).emit("server:controllerLeft", {
        controllerId: controller.controllerId,
      });
    }
    roomManager.deleteController(socket.id);
  });
};
