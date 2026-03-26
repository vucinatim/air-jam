import type { RoomCode, ServerErrorPayload } from "@air-jam/sdk/protocol";
import type { ServerLogger } from "../logging/logger.js";
import type { AuthService } from "../services/auth-service.js";
import type { RoomManager } from "../services/room-manager.js";
import type { AirJamIoServer, AirJamSocket } from "./socket-types.js";

export interface SocketHandlerContext {
  io: AirJamIoServer;
  socket: AirJamSocket;
  logger: ServerLogger;
  roomManager: RoomManager;
  authService: AuthService;
  hostRegistrationRateLimitMax: number;
  controllerJoinRateLimitMax: number;
  staticAppRateLimitMax: number;
  emitError: (socketId: string, payload: ServerErrorPayload) => void;
  isRateLimited: (bucket: string, limit: number) => boolean;
  isScopedRateLimited: (bucket: string, scope: string, limit: number) => boolean;
  isHostAuthorizedForRoom: (roomId: RoomCode) => boolean;
  isControllerAuthorizedForRoom: (
    roomId: RoomCode,
    controllerId?: string,
  ) => boolean;
}
