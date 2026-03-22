import type { RoomCode } from "./core";
import type { PlayerProfile } from "./controller";

export interface ControllerWelcomePayload {
  controllerId: string;
  roomId: RoomCode;
  player?: PlayerProfile;
}

export interface ControllerJoinedNotice {
  controllerId: string;
  nickname?: string;
  player?: PlayerProfile;
}

export interface ControllerLeftNotice {
  controllerId: string;
}

export interface RoomReadyNotice {
  roomId: RoomCode;
}

export interface HostLeftNotice {
  roomId: RoomCode;
  reason: string;
}
