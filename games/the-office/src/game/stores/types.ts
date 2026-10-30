import { type AirJamActionContext } from "@air-jam/sdk/core";
import type { OfficeSettings } from "../contracts/settings";

export type OfficeMatchPhase = "lobby" | "playing" | "ended";

export interface PlayerStats {
  energy: number;
  boredom: number;
  alive: boolean;
}

export interface SpaceGameState {
  matchPhase: OfficeMatchPhase;
  money: Record<string, number>;
  totalMoneyPenalty: number;
  gameDurationMs: number;
  taskDurationMs: number;
  playerAssignments: Record<string, string>;
  busyPlayers: Record<string, string>;
  taskProgress: Record<string, number>;
  playerStats: Record<string, PlayerStats>;
  gameOver: boolean;
  lifecycleVersion: number;
  actions: {
    syncConnectedPlayers: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { connectedPlayerIds: string[] },
    ) => void;
    startMatch: (
      ctx: AirJamActionContext<OfficeSettings>,
      _payload: undefined,
    ) => void;
    restartMatch: (
      ctx: AirJamActionContext<OfficeSettings>,
      _payload: undefined,
    ) => void;
    returnToLobby: (
      ctx: AirJamActionContext<OfficeSettings>,
      _payload: undefined,
    ) => void;
    finishMatch: (
      ctx: AirJamActionContext<OfficeSettings>,
      _payload: undefined,
    ) => void;
    selectCharacter: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { playerId: string },
    ) => void;
    completeTask: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { playerId: string; reward: number },
    ) => void;
    applyPenalty: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { amount: number },
    ) => void;
    setBusy: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { playerId: string; taskName: string | null },
    ) => void;
    setTaskProgress: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { playerId: string; progress: number },
    ) => void;
    setTaskProgressBatch: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { progressByPlayerId: Record<string, number> },
    ) => void;
    updatePlayerStats: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { playerId: string; updates: Partial<PlayerStats> },
    ) => void;
    updatePlayerStatsBatch: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { updatesByPlayerId: Record<string, Partial<PlayerStats>> },
    ) => void;
    restoreEnergy: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { playerId: string; amount: number },
    ) => void;
    restoreBoredom: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { playerId: string; amount: number },
    ) => void;
    killPlayer: (
      ctx: AirJamActionContext<OfficeSettings>,
      payload: { playerId: string },
    ) => void;
  };
}
