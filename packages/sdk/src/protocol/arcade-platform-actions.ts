/**
 * Platform (Arcade shell) commands sent as `controller:action_rpc` / `airjam:action_rpc` with
 * `storeDomain: arcade.surface`. The server routes these to the **master** host socket so they
 * always hit the outer Arcade shell, not an embedded child host.
 *
 * Gameplay actions must not use the `airjam.arcade.` prefix.
 */
export const AIRJAM_ARCADE_PLATFORM_ACTION_PREFIX = "airjam.arcade." as const;

/** Canonical action names for QR overlay and game exit from the controller shell. */
export const airJamArcadePlatformActions = {
  ping: "airjam.arcade.ping",
  toggleQr: "airjam.arcade.toggle_qr",
  showQr: "airjam.arcade.show_qr",
  hideQr: "airjam.arcade.hide_qr",
  exitGame: "airjam.arcade.exit_game",
  updatePlatformSettings: "airjam.arcade.update_platform_settings",
} as const;

export type AirJamArcadePlatformActionName =
  (typeof airJamArcadePlatformActions)[keyof typeof airJamArcadePlatformActions];

/**
 * Server routing: platform UI commands under `airjam.arcade.*` must be delivered to the master
 * host (Arcade shell), not the active embedded game host.
 */
export const isAirJamArcadePlatformPrefixAction = (actionName: string): boolean =>
  actionName.startsWith(AIRJAM_ARCADE_PLATFORM_ACTION_PREFIX);
