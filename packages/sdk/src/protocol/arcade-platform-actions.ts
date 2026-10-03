import { z } from "zod";

/**
 * Platform (Arcade shell) commands sent as `controller:action_rpc` / `airjam:action_rpc` with
 * `storeDomain: arcade.surface`. The server routes these to the **master** host socket so they
 * always hit the outer Arcade shell, not an embedded child host.
 *
 * Gameplay actions must not use the `airjam.arcade.` prefix.
 */
export const AIRJAM_ARCADE_PLATFORM_ACTION_PREFIX = "airjam.arcade." as const;

/** Canonical commands owned by the Arcade shell, never an embedded game. */
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

/**
 * Server routing: platform UI commands under `airjam.arcade.*` must be delivered to the master
 * host (Arcade shell), not the active embedded game host.
 */
export const isAirJamArcadePlatformPrefixAction = (
  actionName: string,
): boolean => actionName.startsWith(AIRJAM_ARCADE_PLATFORM_ACTION_PREFIX);
