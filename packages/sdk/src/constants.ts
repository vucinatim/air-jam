/**
 * Core Air Jam constants used across the SDK
 */

/**
 * Default server port for Air Jam server
 */
export const DEFAULT_SERVER_PORT = 4000;

/**
 * Default path for controller endpoints
 */
export const DEFAULT_CONTROLLER_PATH = "/joypad";

/**
 * Input debounce time in milliseconds
 * Used to prevent rapid input events from overwhelming the system
 */
export const INPUT_DEBOUNCE_MS = 200;

/**
 * Toggle debounce time in milliseconds
 * Used for game state toggles to prevent accidental double-toggles
 */
export const TOGGLE_DEBOUNCE_MS = 300;

/**
 * Socket.IO configuration
 */
export const SOCKET_CONFIG = {
  /**
   * Ping interval in milliseconds
   */
  PING_INTERVAL: 2000,

  /**
   * Ping timeout in milliseconds
   */
  PING_TIMEOUT: 5000,
} as const;

/**
 * Maximum players allowed in a room by default
 */
export const DEFAULT_MAX_PLAYERS = 8;
