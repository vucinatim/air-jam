import type {
  ControllerPrivilegedGrant,
  RoomCode,
} from "@air-jam/sdk/protocol";
import type { RoomManager } from "../services/room-manager.js";

export interface SocketAuthorization {
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

  const hasControllerPrivilegeForRoom = (
    roomId: RoomCode,
    grant: ControllerPrivilegedGrant,
    controllerId?: string,
  ): boolean => {
    if (!isControllerAuthorizedForRoom(roomId, controllerId)) {
      return false;
    }

    const controllerInfo = roomManager.getControllerInfo(socketId);
    if (!controllerInfo || controllerInfo.roomId !== roomId) {
      return false;
    }

    const session = roomManager.getRoom(roomId);
    const controllerSession = session?.controllers.get(controllerInfo.controllerId);
    if (!controllerSession) {
      return false;
    }

    return controllerSession.privilegedGrants.includes(grant);
  };

  return {
    isHostAuthorizedForRoom,
    isControllerAuthorizedForRoom,
    hasControllerPrivilegeForRoom,
  };
};
