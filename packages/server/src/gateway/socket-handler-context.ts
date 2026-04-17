import type {
  ControllerPrivilegedGrant,
  RoomCode,
  ServerErrorPayload,
} from "@air-jam/sdk/protocol";
import type { RuntimeUsagePublisher } from "../analytics/runtime-usage.js";
import type { ServerLogger } from "../logging/logger.js";
import type { HostBootstrapAuthService } from "../services/auth-service.js";
import type { RoomManager } from "../services/room-manager.js";
import type { AirJamIoServer, AirJamSocket } from "./socket-types.js";

export interface SocketHandlerContext {
  io: AirJamIoServer;
  socket: AirJamSocket;
  logger: ServerLogger;
  roomManager: RoomManager;
  authService: HostBootstrapAuthService;
  runtimeUsagePublisher: RuntimeUsagePublisher;
  hostRegistrationRateLimitMax: number;
  controllerJoinRateLimitMax: number;
  staticAppRateLimitMax: number;
  maintenanceMode: boolean;
  emitError: (socketId: string, payload: ServerErrorPayload) => void;
  isRateLimited: (bucket: string, limit: number) => boolean;
  isScopedRateLimited: (bucket: string, scope: string, limit: number) => boolean;
  isHostAuthorizedForRoom: (roomId: RoomCode) => boolean;
  isControllerAuthorizedForRoom: (
    roomId: RoomCode,
    controllerId?: string,
  ) => boolean;
  hasControllerPrivilegeForRoom: (
    roomId: RoomCode,
    grant: ControllerPrivilegedGrant,
    controllerId?: string,
  ) => boolean;
}
