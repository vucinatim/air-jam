/**
 * @module useAirJamController
 * @description Hook for building mobile/web controllers that connect to AirJam hosts.
 *
 * This hook is used on the controller side (typically a mobile phone) to:
 * - Connect to a game session via room code
 * - Send input (joystick, buttons) to the host
 * - Receive game state updates
 * - Handle haptic feedback signals
 *
 * Controllers automatically handle:
 * - Room joining via URL parameter (?room=XXXX) or props
 * - Haptic feedback (vibration patterns on signal receipt)
 *
 * **Standalone:** joins using `?room=` or `roomId` (and optional `controllerId`).
 *
 * **Embedded controller iframe:** when `aj_room` + `aj_controller_id` are present, binds as the
 * platform-injected sub-controller; see
 * {@link ../runtime/embedded-runtime-adapters.readEmbeddedControllerChildSession}.
 */
import type {
  ConnectionStatus,
  ControllerOrientation,
  ControllerStatePayload,
  ControllerUpdatePlayerProfileAck,
  GameState,
  PlayerProfile,
  PlayerProfilePatch,
  RoomCode,
} from "../protocol";
import type { AirJamRealtimeClient } from "../runtime/realtime-client";
import { useControllerRuntimeApi } from "./internal/use-controller-runtime-api";

/**
 * Options for configuring the controller connection.
 *
 * @example Basic usage (room from URL)
 * ```tsx
 * // URL: https://yourgame.com/controller?room=ABCD
 * const controller = useAirJamController();
 * // Automatically joins room ABCD
 * ```
 *
 * @example With nickname
 * ```tsx
 * const controller = useAirJamController({
 *   nickname: playerName,
 *   onState: (state) => {
 *     if (state.gameState === "playing") startGame();
 *   },
 * });
 * ```
 */
export interface AirJamControllerOptions {
  /**
   * Room ID (4-character code) to join.
   * Can also be provided via URL query parameter: `?room=XXXX`
   * The URL parameter takes precedence if both are provided.
   */
  roomId?: string;
  /**
   * Player nickname to display in the game.
   * If not provided, the server assigns a random label.
   */
  nickname?: string;
  /**
   * Preset avatar id sent on join (optional).
   */
  avatarId?: string;
  /**
   * Controller ID for this instance.
   * Auto-generated if not provided. Persists across reconnects.
   */
  controllerId?: string;
  /**
   * Called when the host sends a state update (game state, messages, etc.)
   */
  onState?: (state: ControllerStatePayload) => void;
}

/**
 * Return type of useAirJamController hook.
 *
 * Provides state and functions for a mobile/web controller interface.
 */
export interface AirJamControllerApi {
  /** Room code this controller is connected to (or attempting to join) */
  roomId: RoomCode | null;
  /** This controller's unique ID */
  controllerId: string | null;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Last error message, if any */
  lastError?: string;
  /** Current game state (paused or playing) */
  gameState: GameState;
  /** Intended controller presentation orientation for the active game UI. */
  controllerOrientation: ControllerOrientation;
  /** Optional message from the host (e.g., "Get Ready!") */
  stateMessage?: string;
  /**
   * Send a system command to the host.
   *
   * @example Toggle pause
   * ```ts
   * controller.sendSystemCommand("toggle_pause");
   * ```
   */
  sendSystemCommand: (command: "exit" | "toggle_pause") => void;
  /**
   * Update the player nickname (local draft for next join).
   */
  setNickname: (value: string) => void;
  /**
   * Update preset avatar id (local draft for next join).
   */
  setAvatarId: (value: string) => void;
  /**
   * Patch display name and/or avatar on the server without reconnecting.
   */
  updatePlayerProfile: (
    patch: PlayerProfilePatch,
  ) => Promise<ControllerUpdatePlayerProfileAck>;
  /** Force reconnection to the room */
  reconnect: () => void;
  /** List of all connected players in the room */
  players: PlayerProfile[];
  /** Realtime client for controller events (socket-backed standalone, bridge-backed in arcade embeds) */
  socket: AirJamRealtimeClient | null;
}

/**
 * Hook for building mobile/web controllers that connect to AirJam hosts.
 *
 * This hook handles all the complexity of connecting a mobile controller to a game:
 * - Automatic room joining from URL parameters
 * - Input runtime/session state for `useInputWriter`
 * - Haptic feedback on signal receipt (vibration)
 * - Game state synchronization
 * - Auto-reconnection on disconnect
 *
 * This hook automatically adapts between standalone and arcade iframe runtimes.
 *
 * **Typical usage flow:**
 * 1. Player scans QR code on game screen
 * 2. Opens controller URL with ?room=XXXX parameter
 * 3. Controller auto-connects to the game session
 * 4. Player uses joystick/buttons to send input
 * 5. Receives haptic feedback on game events
 *
 * @param options - Configuration options
 * @returns Controller API with state and functions
 *
 * @example Basic controller setup
 * ```tsx
 * const ControllerView = () => {
 *   const controller = useAirJamController();
 *
 *   if (controller.connectionStatus !== "connected") {
 *     return <div>Connecting to room {controller.roomId}...</div>;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Connected: {controller.controllerId}</p>
 *       <p>Game: {controller.gameState}</p>
 *     </div>
 *   );
 * };
 * ```
 *
 * @example With state callback
 * ```tsx
 * const controller = useAirJamController({
 *   onState: (state) => {
 *     if (state.message) {
 *       showNotification(state.message);
 *     }
 *   },
 * });
 * ```
 */
export const useAirJamController = (
  options: AirJamControllerOptions = {},
): AirJamControllerApi => {
  return useControllerRuntimeApi(options, "useAirJamController");
};
