/**
 * Air Jam Socket.IO event names
 * Centralized to ensure consistency and type safety
 */

/**
 * Host events
 */
export const HostEvents = {
  /**
   * Register as a master host (standalone mode)
   */
  REGISTER: "host:register",

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
 * Client events (server -> controller shell)
 */
export const ClientEvents = {
  /**
   * Load a game UI in the controller iframe
   */
  LOAD_UI: "client:loadUi",

  /**
   * Unload the game UI from the controller iframe
   */
  UNLOAD_UI: "client:unloadUi",

  /**
   * Update game state display
   */
  STATE: "client:state",
} as const;

/**
 * Child events (server -> child host)
 */
export const ChildEvents = {
  /**
   * Server requests child to close
   */
  CLOSE: "child:close",
} as const;

/**
 * All events combined for easy reference
 */
export const Events = {
  Host: HostEvents,
  Controller: ControllerEvents,
  System: SystemEvents,
  Server: ServerEvents,
  Client: ClientEvents,
  Child: ChildEvents,
} as const;
