import { useMemo } from "react";
import type { ConnectionRole, RoomCode } from "../../protocol";
import { roomCodeSchema } from "../../protocol";
import { generateControllerId } from "../../utils/ids";

export interface RoomSetupOptions {
  roomId?: string;
  role: ConnectionRole;
  controllerId?: string;
  getRoomFromLocation?: () => string | null;
}

/**
 * Handles room ID parsing and controller ID generation
 * Provides validated room code and controller ID for hooks
 *
 * @param options - Setup configuration
 * @returns Parsed room ID and controller ID
 */
export function useRoomSetup(options: RoomSetupOptions): {
  parsedRoomId: RoomCode | null;
  controllerId: string | null;
} {
  const parsedRoomId = useMemo<RoomCode | null>(() => {
    const code = options.roomId ?? options.getRoomFromLocation?.();
    if (!code) {
      return null;
    }
    try {
      return roomCodeSchema.parse(code.toUpperCase());
    } catch {
      return null;
    }
  }, [options.roomId, options.getRoomFromLocation]);

  const controllerId = useMemo<string | null>(() => {
    if (options.role === "host") {
      return null; // Hosts don't need controller IDs
    }

    // Use provided ID, check URL params, or generate new one
    if (options.controllerId) {
      return options.controllerId;
    }

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlControllerId = params.get("controllerId");
      if (urlControllerId) {
        return urlControllerId;
      }
    }

    return generateControllerId();
  }, [options.controllerId, options.role]);

  return {
    parsedRoomId,
    controllerId,
  };
}
