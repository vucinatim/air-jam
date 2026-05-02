import type { ControllerSource, PlayerProfile } from "./controller";
import type { RoomCode } from "./core";

export interface ControllerPresenceNotice {
  controllerId: string;
  deviceId?: string;
  nickname?: string;
  source: ControllerSource;
  connected: boolean;
  resumeLeaseExpiresAt: number | null;
  player?: PlayerProfile;
}

export interface ControllerWelcomePayload {
  controllerId: string;
  roomId: RoomCode;
  resumed?: boolean;
  player?: PlayerProfile;
  players?: PlayerProfile[];
  controllers?: ControllerPresenceNotice[];
}

export interface ControllerJoinedNotice extends ControllerPresenceNotice {
  resumed?: boolean;
}

export interface ControllerLeftNotice {
  controllerId: string;
}

/** Emitted when a controller updates their profile (label / avatar) after join. */
export interface PlayerUpdatedNotice {
  player: PlayerProfile;
}

export interface RoomReadyNotice {
  roomId: RoomCode;
}

export interface HostLeftNotice {
  roomId: RoomCode;
  reason: string;
}
