import {
  AIRJAM_DEV_LOG_EVENTS,
  type ServerErrorPayload,
} from "@air-jam/sdk/protocol";
import {
  createRateLimitGuard,
  createScopedRateLimitGuard,
  resolveSocketIdentifier,
} from "../policies/rate-limit-policy.js";
import { createSocketAuthorization } from "../policies/socket-authorization.js";
import type { HostBootstrapAuthService } from "../services/auth-service.js";
import type { RateLimitService } from "../services/rate-limit-service.js";
import type { RoomManager } from "../services/room-manager.js";
import { registerControllerHandlers } from "./handlers/register-controller-handlers.js";
import { registerDisconnectHandler } from "./handlers/register-disconnect-handler.js";
import { registerHostLifecycleHandlers } from "./handlers/register-host-lifecycle-handlers.js";
import { registerRealtimeHandlers } from "./handlers/register-realtime-handlers.js";
import type { SocketHandlerContext } from "./socket-handler-context.js";
import type { AirJamIoServer, AirJamSocket } from "./socket-types.js";
import type { ServerLogger } from "../logging/logger.js";

export interface RegisterSocketHandlersOptions {
  io: AirJamIoServer;
  socket: AirJamSocket;
  logger: ServerLogger;
  roomManager: RoomManager;
  rateLimitService: RateLimitService;
  authService: HostBootstrapAuthService;
  rateLimitWindowMs: number;
  hostRegistrationRateLimitMax: number;
  controllerJoinRateLimitMax: number;
  staticAppRateLimitMax: number;
}

export const registerSocketHandlers = ({
  io,
  socket,
  logger,
  roomManager,
  rateLimitService,
  authService,
  rateLimitWindowMs,
  hostRegistrationRateLimitMax,
  controllerJoinRateLimitMax,
  staticAppRateLimitMax,
}: RegisterSocketHandlersOptions): void => {
  const { isHostAuthorizedForRoom, isControllerAuthorizedForRoom } =
    createSocketAuthorization(socket.id, roomManager);

  const socketIdentifier = resolveSocketIdentifier(
    socket.handshake.headers["x-forwarded-for"],
    socket.handshake.address,
    socket.id,
  );
  const isRateLimited = createRateLimitGuard(
    rateLimitService,
    socketIdentifier,
    rateLimitWindowMs,
  );
  const isScopedRateLimited = createScopedRateLimitGuard(
    rateLimitService,
    rateLimitWindowMs,
  );
  const socketLogger = logger.child({
    scope: "socket",
    socketId: socket.id,
    socketIdentifier,
    origin:
      typeof socket.handshake.headers.origin === "string"
        ? socket.handshake.headers.origin
        : undefined,
  });

  const emitError = (socketId: string, payload: ServerErrorPayload): void => {
    io.to(socketId).emit("server:error", payload);
  };

  const context: SocketHandlerContext = {
    io,
    socket,
    logger: socketLogger,
    roomManager,
    authService,
    hostRegistrationRateLimitMax,
    controllerJoinRateLimitMax,
    staticAppRateLimitMax,
    emitError,
    isRateLimited,
    isScopedRateLimited,
    isHostAuthorizedForRoom,
    isControllerAuthorizedForRoom,
  };

  socketLogger.debug(
    { event: AIRJAM_DEV_LOG_EVENTS.socket.connected },
    "Socket connected",
  );

  registerHostLifecycleHandlers(context);
  registerControllerHandlers(context);
  registerRealtimeHandlers(context);
  registerDisconnectHandler(context);
};
