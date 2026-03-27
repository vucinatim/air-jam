import { AIRJAM_DEV_LOG_EVENTS } from "@air-jam/sdk/protocol";
import { createRoomRuntimeUsageEvent } from "../../analytics/runtime-usage.js";
import {
  beginRoomClosing,
  getChildHostDisconnectTeardownMs,
  transitionToSystemFocus,
} from "../../domain/room-session-domain.js";
import type { SocketHandlerContext } from "../socket-handler-context.js";

export const registerDisconnectHandler = (
  context: SocketHandlerContext,
): void => {
  const { io, socket, roomManager, runtimeUsagePublisher } = context;
  const logger = context.logger.child({ component: "disconnect" });

  const getDisconnectLogger = (bindings: Record<string, unknown> = {}) => {
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

  socket.on("disconnect", (reason) => {
    logger.debug(
      {
        event: AIRJAM_DEV_LOG_EVENTS.socket.disconnected,
        reason,
        traceId: socket.data.hostAuthority?.traceId,
        roomId: socket.data.controllerAuthority?.roomId,
        controllerId: socket.data.controllerAuthority?.controllerId,
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
        getDisconnectLogger({ roomId }).info(
          {
            event:
              AIRJAM_DEV_LOG_EVENTS.childHost.disconnectPendingSystemFocus,
            reason,
            teardownMs: getChildHostDisconnectTeardownMs(),
          },
          "Child host disconnected; scheduled system focus restore",
        );
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
          const previousGameId = current.activeGameId;
          beginRoomClosing(current);
          transitionToSystemFocus(io, current, {
            resyncPlayersToMaster: true,
          });
          runtimeUsagePublisher.publish(
            createRoomRuntimeUsageEvent(current, {
              kind: "game_returned_to_system",
              gameId: previousGameId,
              payload: {
                reason: "child_host_disconnect_timeout",
              },
            }),
          );
          getDisconnectLogger({ roomId }).info(
            {
              event:
                AIRJAM_DEV_LOG_EVENTS.childHost.disconnectSystemFocusRestored,
              reason,
            },
            "Child host teardown restored system focus",
          );
        }, getChildHostDisconnectTeardownMs());
        roomManager.deleteHost(socket.id);
        return;
      } else if (socket.id === session.masterHostSocketId) {
        getDisconnectLogger({ roomId }).info(
          {
            event: AIRJAM_DEV_LOG_EVENTS.host.disconnectPendingRoomClose,
            reason,
            teardownMs: 3000,
          },
          "Master host disconnected; scheduled room close",
        );
        setTimeout(() => {
          const currentSession = roomManager.getRoom(roomId);
          if (currentSession && currentSession.masterHostSocketId === socket.id) {
            runtimeUsagePublisher.publish(
              createRoomRuntimeUsageEvent(currentSession, {
                kind: "room_closed",
                payload: {
                  reason: "host_disconnected",
                },
              }),
            );
            getDisconnectLogger({ roomId }).info(
              {
                event: AIRJAM_DEV_LOG_EVENTS.host.disconnectRoomClosed,
                reason,
              },
              "Room closed after master host disconnect",
            );
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
      runtimeUsagePublisher.publish(
        createRoomRuntimeUsageEvent(session, {
          kind: "controller_disconnected",
          payload: {
            controllerId: controller.controllerId,
            reason,
          },
        }),
      );
      getDisconnectLogger({
        roomId: controller.roomId,
        controllerId: controller.controllerId,
      }).info(
        {
          event: AIRJAM_DEV_LOG_EVENTS.controller.disconnectApplied,
          reason,
        },
        "Controller disconnected and was removed from room",
      );
    }
    roomManager.deleteController(socket.id);
    delete socket.data.controllerAuthority;
  });
};
