import type { RoomCode } from "../protocol";
import { roomCodeSchema } from "../protocol";
import type { ArcadeSurfaceRuntimeIdentity } from "./arcade-surface-identity";
import {
  readChildHostRuntimeParams,
  readEmbeddedControllerRuntimeParams,
} from "./runtime-session-params";

/**
 * Embedded host session for a game running inside the platform shell iframe (`aj_room`, `aj_token`, …).
 * Standalone hosts do not produce this snapshot — they use normal room create/reconnect flow.
 */
export type EmbeddedHostChildSession = {
  roomId: RoomCode;
  joinUrl?: string;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
};

/**
 * Embedded controller session for the secondary controller iframe (`aj_room`, `aj_controller_id`, …).
 */
export type EmbeddedControllerChildSession = {
  roomId: RoomCode;
  controllerId: string;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
};

/**
 * Reads and validates embedded host bootstrap from the current window URL, or `null` if not embedded.
 */
export const readEmbeddedHostChildSession = (): EmbeddedHostChildSession | null => {
  const raw = readChildHostRuntimeParams();
  if (!raw) {
    return null;
  }
  return {
    roomId: roomCodeSchema.parse(raw.room.toUpperCase()),
    joinUrl: raw.joinUrl,
    arcadeSurface: raw.arcadeSurface,
  };
};

/**
 * Reads and validates embedded controller bootstrap from the current window URL, or `null` if not embedded.
 */
export const readEmbeddedControllerChildSession =
  (): EmbeddedControllerChildSession | null => {
    const raw = readEmbeddedControllerRuntimeParams();
    if (!raw) {
      return null;
    }
    return {
      roomId: roomCodeSchema.parse(raw.room.toUpperCase()),
      controllerId: raw.controllerId,
      arcadeSurface: raw.arcadeSurface,
    };
  };
