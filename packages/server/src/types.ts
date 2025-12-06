import type { GameState, PlayerProfile, RoomCode } from "@air-jam/sdk/protocol";

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
 * Room session state
 */
export interface RoomSession {
  roomId: RoomCode;
  masterHostSocketId: string; // The Arcade (System)
  childHostSocketId?: string; // The Game (Child)
  focus: RoomFocus;
  joinToken?: string; // Token required for a child to join
  activeControllerUrl?: string;
  controllers: Map<string, ControllerSession>;
  maxPlayers: number;
  gameState: GameState;
}

/**
 * Index entry for controller tracking
 */
export interface ControllerIndexEntry {
  roomId: RoomCode;
  controllerId: string;
}
