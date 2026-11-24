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
import { useContext } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useAirJamContext } from "../context/air-jam-context";
import { useAssertSessionScope } from "../context/session-scope";
import type { AirJamConnectionState } from "../core/connection-store";
import type { ControllerInput } from "../core/controller-input";
import type { RoomActionAck } from "../core/room-action-ack";
import { createAirJamDiagnosticError } from "../diagnostics";
import type {
  AirJamPlayer,
  ConnectionStatus,
  PlayerProfilePatch,
  RoomCode,
} from "../protocol";
import type { ControllerOrientation, RuntimeState } from "../room-protocol";
import type { PhoneRoomSession } from "../room-session/phone-room-session";
import { controllerRuntimeContext } from "../runtime/runtime-owner-contexts";

/**
 * Options for configuring the controller runtime boundary.
 *
 * @example Basic runtime boundary usage (room from URL)
 * ```tsx
 * // URL: https://yourgame.com/controller?room=ABCD
 * <airjam.Controller>
 *   <ControllerView />
 * </airjam.Controller>
 * ```
 *
 * @example With nickname
 * ```tsx
 * <airjam.Controller
 *   nickname={playerName}
 *   onState={(state) => {
 *     if (state.runtimeState === "playing") startGame();
 *   }}
 * >
 *   <ControllerView />
 * </airjam.Controller>
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
   * If not provided, the room names the player "Player N".
   */
  nickname?: string;
  /**
   * Preset avatar id sent on join (optional).
   */
  avatarId?: string;
}

/**
 * Return type of useAirJamController hook.
 *
 * Provides state and functions for a mobile/web controller interface.
 */
export interface AirJamControllerApi {
  /** This player's declared controls; null when the game declares none. */
  input: ControllerInput | null;
  /** Room code this controller is connected to (or attempting to join) */
  roomId: RoomCode | null;
  /** This player's seat id (`p1`, `p2`…), given by the room; null until it welcomes the phone */
  controllerId: string | null;
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Last error message, if any */
  lastError?: string;
  /** Current game state (paused or playing) */
  runtimeState: RuntimeState;
  /** Intended controller presentation orientation for the active game UI. */
  controllerOrientation: ControllerOrientation;
  /**
   * Send a system command to the host.
   *
   * @example Pause or resume
   * ```ts
   * controller.sendSystemCommand("pause");
   * controller.sendSystemCommand("resume");
   * ```
   */
  sendSystemCommand: (command: "pause" | "resume") => void;
  /**
   * Update the player nickname (local draft for next join).
   */
  setNickname: (value: string) => void;
  /**
   * Update preset avatar id (local draft for next join).
   */
  setAvatarId: (value: string) => void;
  /**
   * Changes the display name and/or avatar without reconnecting; every
   * device learns it from the room. Settles once the room shows the change
   * on this seat, or as unconfirmed when the patch is invalid, there is no
   * seat, or the link drops first.
   */
  updatePlayerProfile: (patch: PlayerProfilePatch) => Promise<RoomActionAck>;
  /**
   * Gives the seat up for good and forgets it on this device; settles once
   * the room confirms it.
   */
  leave: () => Promise<RoomActionAck>;
  /** List of all connected players in the room */
  players: AirJamPlayer[];
  /** This controller's current player profile when known. */
  selfPlayer: AirJamPlayer | null;
  /** The seat's session while the controller runs; null before it starts or without a room. */
  session: PhoneRoomSession | null;
}

export interface AirJamControllerState {
  roomId: RoomCode | null;
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  lastError?: string;
  runtimeState: RuntimeState;
  controllerOrientation: ControllerOrientation;
  players: AirJamPlayer[];
  selfPlayer: AirJamPlayer | null;
}

export type AirJamControllerRuntimeControls = Pick<
  AirJamControllerApi,
  | "sendSystemCommand"
  | "setNickname"
  | "setAvatarId"
  | "updatePlayerProfile"
  | "leave"
  | "session"
  | "input"
>;

const toControllerState = (
  state: AirJamConnectionState,
): AirJamControllerState => {
  const selfPlayer = state.controllerId
    ? (state.players.find((player) => player.id === state.controllerId) ?? null)
    : null;

  return {
    roomId: state.roomId,
    controllerId: state.controllerId,
    connectionStatus: state.connectionStatus,
    lastError: state.lastError,
    runtimeState: state.runtimeState,
    controllerOrientation: state.controllerOrientation,
    players: state.players,
    selfPlayer,
  };
};

/**
 * Read the mounted controller runtime API.
 *
 * Use this inside the explicit `airjam.Controller` runtime boundary. Runtime
 * ownership is mounted once at the
 * boundary; child code reads from that runtime through this hook.
 *
 * **Typical usage flow:**
 * 1. Player scans QR code on game screen
 * 2. Opens controller URL with ?room=XXXX parameter
 * 3. Controller auto-connects to the game session
 * 4. Player uses joystick/buttons to send input
 * 5. Receives haptic feedback on game events
 *
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
 *       <p>Game: {controller.runtimeState}</p>
 *     </div>
 *   );
 * };
 * ```
 *
 * @example With state callback
 * ```tsx
 * <airjam.Controller
 *   onState={(state) => {
 *     if (state.message) {
 *       showNotification(state.message);
 *     }
 *   }}
 * >
 *   <ControllerView />
 * </airjam.Controller>
 * ```
 */
export function useAirJamController(): AirJamControllerApi;
export function useAirJamController<TSelected>(
  selector: (state: AirJamControllerState) => TSelected,
): TSelected;
export function useAirJamController<TSelected>(
  selector?: (state: AirJamControllerState) => TSelected,
): AirJamControllerApi | TSelected {
  useAssertSessionScope("controller", "useAirJamController");

  const { store } = useAirJamContext();
  const selectedState = useStore(
    store,
    useShallow((state) => {
      const controllerState = toControllerState(state);
      return selector ? selector(controllerState) : controllerState;
    }),
  );
  const runtime = useContext(
    controllerRuntimeContext,
  ) as AirJamControllerRuntimeControls | null;
  if (!runtime) {
    throw createAirJamDiagnosticError(
      "AJ_SCOPE_MISMATCH",
      "useAirJamController requires a mounted controller runtime boundary. Wrap the controller tree with <airjam.Controller> before reading controller state.",
      {
        hookName: "useAirJamController",
        expectedScope: "controller",
        receivedScope: "controller",
      },
    );
  }

  if (selector) {
    return selectedState as TSelected;
  }

  return {
    ...(selectedState as AirJamControllerState),
    ...runtime,
  };
}
