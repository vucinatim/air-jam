/**
 * Air Jam Socket.IO event names
 * Centralized to ensure consistency and type safety
 */

/**
 * Host events
 */
export const HostEvents = {
  /**
   * Bootstrap host authority for the current socket.
   */
  BOOTSTRAP: "host:bootstrap",

  /**
   * Register as the system/arcade master host
   */
  REGISTER_SYSTEM: "host:registerSystem",

  /**
   * Join as a child host (game launched from arcade)
   */
  JOIN_AS_CHILD: "host:joinAsChild",
} as const;

/**
 * Controller events
 */
export const ControllerEvents = {
  /**
   * Controller joins a room
   */
  JOIN: "controller:join",

  /**
   * Controller sends input
   */
  INPUT: "controller:input",

  /**
   * Controller leaves a room
   */
  LEAVE: "controller:leave",

  /**
   * Controller sends game state update
   */
  STATE: "controller:state",

  /**
   * Controller sends system command
   */
  SYSTEM: "controller:system",
} as const;

/**
 * System events (Arcade-specific)
 */
export const SystemEvents = {
  /**
   * Arcade launches a game
   */
  LAUNCH_GAME: "system:launchGame",

  /**
   * Arcade closes a game
   */
  CLOSE_GAME: "system:closeGame",
} as const;

/**
 * Server events (server -> client)
 */
export const ServerEvents = {
  /**
   * Welcome message with room/controller info
   */
  WELCOME: "server:welcome",

  /**
   * Room is ready
   */
  ROOM_READY: "server:roomReady",

  /**
   * Controller joined notification
   */
  CONTROLLER_JOINED: "server:controllerJoined",

  /**
   * Controller left notification
   */
  CONTROLLER_LEFT: "server:controllerLeft",

  /**
   * Player profile updated (label / avatar) after join
   */
  PLAYER_UPDATED: "server:playerUpdated",

  /**
   * Host left notification
   */
  HOST_LEFT: "server:hostLeft",

  /**
   * Server error
   */
  ERROR: "server:error",

  /**
   * Play sound on client
   */
  PLAY_SOUND: "server:playSound",
} as const;

/**
 * All events combined for easy reference
 */
export const Events = {
  Host: HostEvents,
  Controller: ControllerEvents,
  System: SystemEvents,
  Server: ServerEvents,
} as const;
