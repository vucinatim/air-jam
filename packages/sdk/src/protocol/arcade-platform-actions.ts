import { z } from "zod";

/**
 * Commands owned by the Arcade shell, never an embedded game: requests on
 * the shell's `arcade.surface` channel, which no game frame's view reaches.
 */
export const airJamArcadePlatformActions = {
  navigate: "airjam.arcade.navigate",
  confirm: "airjam.arcade.confirm",
  ping: "airjam.arcade.ping",
  toggleQr: "airjam.arcade.toggle_qr",
  showQr: "airjam.arcade.show_qr",
  hideQr: "airjam.arcade.hide_qr",
  exitGame: "airjam.arcade.exit_game",
  updateRoomSettings: "airjam.arcade.update_room_settings",
} as const;

/** Menu commands refer to the exact browser surface on which the gesture began. */
export const arcadeBrowserConfirmPayloadSchema = z
  .object({ epoch: z.number().int().positive().safe() })
  .strict();

export const arcadeBrowserNavigatePayloadSchema =
  arcadeBrowserConfirmPayloadSchema.extend({
    direction: z.enum(["up", "down", "left", "right"]),
  });

export type ArcadeBrowserDirection = z.infer<
  typeof arcadeBrowserNavigatePayloadSchema
>["direction"];

export type AirJamArcadePlatformActionName =
  (typeof airJamArcadePlatformActions)[keyof typeof airJamArcadePlatformActions];
