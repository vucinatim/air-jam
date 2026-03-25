import type {
  ControllerStateMessage,
  GameState,
  PlayerProfile,
  RoomCode,
} from "@air-jam/sdk/protocol";

type ControllerOrientation = NonNullable<
  ControllerStateMessage["state"]["orientation"]
>;

/**
 * Controller session information
 */
export interface ControllerSession {
  controllerId: string;
  nickname?: string;
  socketId: string;
  playerProfile: PlayerProfile;
}

/**
 * Room focus state - determines which host receives inputs
 */
export type RoomFocus = "SYSTEM" | "GAME";

/**
 * Explicit room lifecycle state
 */
export type RoomLifecycleState =
  | "SYSTEM_IDLE"
  | "GAME_LAUNCH_PENDING"
  | "GAME_ACTIVE"
  | "CLOSING"
  | "TEARDOWN";

/**
 * Room session state
 */
export interface RoomSession {
  roomId: RoomCode;
  masterHostSocketId: string; // The Arcade (System)
  childHostSocketId?: string; // The Game (Child)
  focus: RoomFocus;
  joinToken?: string; // Token required for a child to join
  /** Set when a game is launched from the system host (`system:launchGame`). */
  activeGameId?: string;
  /**
   * Controller surface URL recorded at launch for routing (`focus`), reconnect snapshots
   * (`host:reconnect` ack), and legacy `client:loadUi` hints. Arcade browser/game chrome is not
   * owned here — platform replicated surface state is authoritative for that UI.
   */
  activeControllerUrl?: string;
  controllers: Map<string, ControllerSession>;
  maxPlayers: number;
  gameState: GameState;
  controllerOrientation: ControllerOrientation;
  lifecycleState: RoomLifecycleState;
  /** Deferred teardown when child host socket drops (Socket.IO reconnect grace). */
  pendingChildTeardownTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Index entry for controller tracking
 */
export interface ControllerIndexEntry {
  roomId: RoomCode;
  controllerId: string;
}
