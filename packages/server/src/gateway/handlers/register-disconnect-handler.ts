import {
  beginRoomClosing,
  getChildHostDisconnectTeardownMs,
  transitionToSystemFocus,
} from "../../domain/room-session-domain.js";
import type { SocketHandlerContext } from "../socket-handler-context.js";

export const registerDisconnectHandler = (
  context: SocketHandlerContext,
): void => {
  const { io, socket, roomManager, logger } = context;

  socket.on("disconnect", (reason) => {
    logger.debug(
      {
        reason,
        traceId: socket.data.hostAuthority?.traceId,
      },
      "Socket disconnected",
    );
    const roomId = roomManager.getRoomByHostId(socket.id);
    if (roomId) {
      const session = roomManager.getRoom(roomId);
      if (!session) {
        roomManager.deleteHost(socket.id);
        return;
      }

      if (socket.id === session.childHostSocketId) {
        if (session.pendingChildTeardownTimer) {
          clearTimeout(session.pendingChildTeardownTimer);
        }
        session.childHostSocketId = undefined;
        session.pendingChildTeardownTimer = setTimeout(() => {
          session.pendingChildTeardownTimer = undefined;
          const current = roomManager.getRoom(roomId);
          if (!current) {
            return;
          }
          const childAlive =
            current.childHostSocketId &&
            io.sockets.sockets.get(current.childHostSocketId)?.connected;
          if (childAlive) {
            return;
          }
          beginRoomClosing(current);
          transitionToSystemFocus(io, current, {
            resyncPlayersToMaster: true,
          });
        }, getChildHostDisconnectTeardownMs());
        roomManager.deleteHost(socket.id);
        return;
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
