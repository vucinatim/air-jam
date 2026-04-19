import type { ResolvedAirJamRuntimeTopology } from "@air-jam/runtime-topology";
import type { RoomCode } from "../protocol";
import { roomCodeSchema } from "../protocol";
import type { ArcadeSurfaceRuntimeIdentity } from "./arcade-surface-identity";
import {
  readChildHostRuntimeParams,
  readEmbeddedControllerRuntimeParams,
} from "./runtime-session-params";

/**
 * Embedded host session for a game running inside the platform shell iframe (`aj_room`, `aj_cap`, …).
 * Standalone hosts do not produce this snapshot — they use normal room create/reconnect flow.
 */
export type EmbeddedHostChildSession = {
  roomId: RoomCode;
  joinUrl?: string;
  topology: ResolvedAirJamRuntimeTopology;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
};

/**
 * Embedded controller session for the secondary controller iframe (`aj_room`, `aj_controller_id`, …).
 */
export type EmbeddedControllerChildSession = {
  roomId: RoomCode;
  controllerId: string;
  topology: ResolvedAirJamRuntimeTopology;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
  playerProfile?: {
    label?: string;
    avatarId?: string;
  };
};

/**
 * Reads and validates embedded host bootstrap from the current window URL, or `null` if not embedded.
 */
export const readEmbeddedHostChildSession =
  (): EmbeddedHostChildSession | null => {
    const raw = readChildHostRuntimeParams();
    if (!raw) {
      return null;
    }
    return {
      roomId: roomCodeSchema.parse(raw.room.toUpperCase()),
      joinUrl: raw.joinUrl,
      topology: raw.topology,
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
      topology: raw.topology,
      arcadeSurface: raw.arcadeSurface,
      ...(raw.playerProfile ? { playerProfile: raw.playerProfile } : {}),
    };
  };
