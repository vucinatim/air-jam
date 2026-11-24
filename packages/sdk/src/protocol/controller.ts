import { z } from "zod";
import type { SeatView } from "../room-protocol";
import type { RoomPlatformSettingsSnapshot } from "../settings/platform-settings";

export { DEFAULT_ROOM_PLATFORM_SETTINGS } from "../settings/platform-settings";

export type ControllerInputPayload = Record<string, unknown>;

/** How a player shows: the name, colour and avatar their seat carries. */
export const playerProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string().optional(),
  avatarId: z.string().optional(),
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;

/**
 * A player in the room: the seat the room gave their phone, with its
 * profile, whether the phone is connected and what kind of device holds it.
 */
export type AirJamPlayer = SeatView;

export const playerProfilePatchSchema = z
  .object({
    label: z.string().trim().min(1).max(24).optional(),
    avatarId: z.string().trim().min(1).max(48).optional(),
  })
  .strict();

export type PlayerProfilePatch = z.infer<typeof playerProfilePatchSchema>;

export type ControllerRoomSettingsState = RoomPlatformSettingsSnapshot;
