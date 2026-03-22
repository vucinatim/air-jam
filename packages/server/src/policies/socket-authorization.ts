import type { RoomCode } from "@air-jam/sdk/protocol";
import type { RoomManager } from "../services/room-manager.js";

export interface SocketAuthorization {
  isHostAuthorizedForRoom: (roomId: RoomCode) => boolean;
  isControllerAuthorizedForRoom: (
    roomId: RoomCode,
    controllerId?: string,
  ) => boolean;
}

export const createSocketAuthorization = (
  socketId: string,
  roomManager: RoomManager,
): SocketAuthorization => {
  const isHostAuthorizedForRoom = (roomId: RoomCode): boolean =>
    roomManager.getRoomByHostId(socketId) === roomId;

  const isControllerAuthorizedForRoom = (
    roomId: RoomCode,
    controllerId?: string,
  ): boolean => {
    const controllerInfo = roomManager.getControllerInfo(socketId);
    if (!controllerInfo || controllerInfo.roomId !== roomId) {
      return false;
    }

    if (controllerId && controllerInfo.controllerId !== controllerId) {
      return false;
    }

    return true;
  };

  return {
    isHostAuthorizedForRoom,
    isControllerAuthorizedForRoom,
  };
};
