/**
 * @module useAirJamHost
 * @description Primary hook for host/game functionality in the AirJam SDK.
 *
 * This hook connects your game to the AirJam server as a "host" and provides
 * all the functionality needed to manage a multiplayer session:
 * - Room management (create/join rooms)
 * - Player tracking (join/leave events, player list)
 * - Input handling (typed and behavior-aware controller input)
 * - Signaling (send haptic feedback, toast notifications to controllers)
 * - Game state management (pause/play, broadcast state)
 *
 * **Standalone (default):** creates or reconnects a room from session storage / options.
 *
 * **Embedded child host:** when `aj_room` + `aj_token` are present, the hook binds to that
 * room and skips create-room; resolution is centralized in
 * {@link ../runtime/embedded-runtime-adapters.readEmbeddedHostChildSession}.
 */
import type { z } from "zod";
import type {
  ConnectionStatus,
  ControllerStatePayload,
  GameState,
  HapticSignalPayload,
  PlayerProfile,
  RoomCode,
  RunMode,
  ToastSignalPayload,
} from "../protocol";
import type { AirJamRealtimeClient } from "../runtime/realtime-client";
import { useHostRuntimeApi } from "./internal/use-host-runtime-api";

export type JoinUrlStatus = "loading" | "ready" | "unavailable";

/**
 * Options for configuring the host connection.
 *
 * @example Basic usage with callbacks
 * ```tsx
 * const host = useAirJamHost({
 *   onPlayerJoin: (player) => {
 *     console.log(`${player.label} joined!`);
 *     spawnPlayerShip(player.id);
 *   },
 *   onPlayerLeave: (controllerId) => {
 *     console.log(`Player ${controllerId} left`);
 *     removePlayerShip(controllerId);
 *   },
 * });
 * ```
 *
 * @example With custom room ID
 * ```tsx
 * const host = useAirJamHost({
 *   roomId: "GAME1",  // Custom 4-character room code
 *   maxPlayers: 4,    // Override provider's maxPlayers
 * });
 * ```
 */
export interface AirJamHostOptions {
  /**
   * Room ID (4-character code) to use for this session.
   * If not provided, a random room code will be generated.
   * Can also be set via URL query parameter: `?room=XXXX`
   */
  roomId?: string;
  /**
   * Called when a player successfully joins the room.
   * Use this to spawn player entities, update UI, etc.
   */
  onPlayerJoin?: (player: PlayerProfile) => void;
  /**
   * Called when a player leaves the room (disconnects or exits).
   * Use this to remove player entities, handle cleanup.
   */
  onPlayerLeave?: (controllerId: string) => void;
}

/**
 * Return type of useAirJamHost hook.
 *
 * Provides all the state and functions needed to run a multiplayer game session.
 *
 * @template TSchema - Zod schema type for input (inferred from provider)
 */
export interface AirJamHostApi<TSchema extends z.ZodSchema = z.ZodSchema> {
  /** The room code for this session (e.g., "ABCD") */
  roomId: RoomCode;
  /** Full URL for controllers to join (display as QR code) */
  joinUrl: string;
  /** Whether the join URL is still being resolved, ready to render, or unavailable */
  joinUrlStatus: JoinUrlStatus;
  /** Current connection status to the server */
  connectionStatus: ConnectionStatus;
  /** List of currently connected players */
  players: PlayerProfile[];
  /** Last error message, if any */
  lastError?: string;
  /** Current run mode (standalone, arcade, platform) */
  mode: RunMode;
  /** Current game state (paused or playing) */
  gameState: GameState;
  /** Toggle between paused and playing states */
  toggleGameState: () => void;
  /**
   * Send state update to all connected controllers.
   * Use for syncing game state, messages, etc.
   */
  sendState: (state: ControllerStatePayload) => boolean;
  /**
   * Send a signal (haptic feedback or toast) to controllers.
   *
   * @example Send haptic to specific player
   * ```ts
   * host.sendSignal("HAPTIC", { pattern: "heavy" }, playerId);
   * ```
   *
   * @example Send toast to all players
   * ```ts
   * host.sendSignal("TOAST", {
   *   title: "Round Start!",
   *   message: "Game begins in 3 seconds",
   * });
   * ```
   */
  sendSignal: {
    (type: "HAPTIC", payload: HapticSignalPayload, targetId?: string): void;
    (type: "TOAST", payload: ToastSignalPayload, targetId?: string): void;
  };
  /** Reconnect to the server */
  reconnect: () => void;
  /** Realtime client for host events (socket-backed standalone, bridge-backed in arcade embeds) */
  socket: AirJamRealtimeClient;
  /**
   * Get the latest input from a specific controller.
   *
   * Returns validated, typed input based on the schema provided to the session provider.
   * Input behavior defaults are tap-safe booleans (`pulse`) and latest vectors (`latest`),
   * with optional per-field overrides.
   *
   * @example In a game loop
   * ```ts
   * useFrame(() => {
   *   players.forEach((player) => {
   *     const input = host.getInput(player.id);
   *     if (input?.action) {
   *       fireWeapon(player.id);
   *     }
   *     movePlayer(player.id, input?.vector ?? { x: 0, y: 0 });
   *   });
   * });
   * ```
   */
  getInput: (controllerId: string) => z.infer<TSchema> | undefined;
}

/**
 * Primary hook for host/game functionality.
 *
 * Connects to the AirJam server as a host and provides everything needed
 * to manage a multiplayer game session. Must be used within an AirJamProvider.
 *
 * This hook is runtime-aware:
 * - standalone: creates/reconnects host rooms directly
 * - arcade iframe runtime: auto-detects `aj_room` + `aj_token` and bridges through the platform-owned host session
 *
 * **Features:**
 * - Automatic room creation and management
 * - Real-time player join/leave events
 * - Typed input with validation and behavior defaults
 * - Haptic feedback and toast notifications
 * - Game state synchronization
 *
 * @template TSchema - Zod schema for input validation (from provider)
 * @param options - Configuration options for the host
 * @returns API object with state and functions
 *
 * @example Basic usage
 * ```tsx
 * const HostView = () => {
 *   const host = useAirJamHost({
 *     onPlayerJoin: (player) => console.log(`${player.label} joined`),
 *     onPlayerLeave: (id) => console.log(`${id} left`),
 *   });
 *
 *   return (
 *     <div>
 *       <h1>Room: {host.roomId}</h1>
 *       <QRCode value={host.joinUrl} />
 *       <p>Players: {host.players.length}</p>
 *       <button onClick={host.toggleGameState}>
 *         {host.gameState === "playing" ? "Pause" : "Play"}
 *       </button>
 *     </div>
 *   );
 * };
 * ```
 *
 * @example Reading input in a game loop
 * ```tsx
 * const GameScene = () => {
 *   const host = useAirJamHost();
 *
 *   useFrame(() => {
 *     host.players.forEach((player) => {
 *       const input = host.getInput(player.id);
 *       if (!input) return;
 *
 *       // Move player based on joystick
 *       movePlayer(player.id, input.vector);
 *
 *       // Handle button press (tap-safe pulse default)
 *       if (input.action) {
 *         playerShoot(player.id);
 *       }
 *     });
 *   });
 *
 *   return <GameCanvas />;
 * };
 * ```
 *
 * @example Sending haptic feedback
 * ```tsx
 * const handleHit = (playerId: string) => {
 *   host.sendSignal("HAPTIC", { pattern: "heavy" }, playerId);
 * };
 * ```
 */
export const useAirJamHost = <TSchema extends z.ZodSchema = z.ZodSchema>(
  options: AirJamHostOptions = {},
): AirJamHostApi<TSchema> => {
  return useHostRuntimeApi<TSchema>(options, "useAirJamHost");
};
