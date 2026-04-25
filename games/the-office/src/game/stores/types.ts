import { type AirJamActionContext } from "@air-jam/sdk";

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
  playerAssignments: Record<string, string>;
  busyPlayers: Record<string, string>;
  taskProgress: Record<string, number>;
  playerStats: Record<string, PlayerStats>;
  gameOver: boolean;
  lifecycleVersion: number;
  actions: {
    syncConnectedPlayers: (
      ctx: AirJamActionContext,
      payload: { connectedPlayerIds: string[] },
    ) => void;
    startMatch: (ctx: AirJamActionContext, _payload: undefined) => void;
    restartMatch: (ctx: AirJamActionContext, _payload: undefined) => void;
    returnToLobby: (ctx: AirJamActionContext, _payload: undefined) => void;
    finishMatch: (ctx: AirJamActionContext, _payload: undefined) => void;
    selectCharacter: (
      ctx: AirJamActionContext,
      payload: { playerId: string },
    ) => void;
    completeTask: (
      ctx: AirJamActionContext,
      payload: { playerId: string; reward: number },
    ) => void;
    applyPenalty: (
      ctx: AirJamActionContext,
      payload: { amount: number },
    ) => void;
    setBusy: (
      ctx: AirJamActionContext,
      payload: { playerId: string; taskName: string | null },
    ) => void;
    setTaskProgress: (
      ctx: AirJamActionContext,
      payload: { playerId: string; progress: number },
    ) => void;
    setTaskProgressBatch: (
      ctx: AirJamActionContext,
      payload: { progressByPlayerId: Record<string, number> },
    ) => void;
    updatePlayerStats: (
      ctx: AirJamActionContext,
      payload: { playerId: string; updates: Partial<PlayerStats> },
    ) => void;
    updatePlayerStatsBatch: (
      ctx: AirJamActionContext,
      payload: { updatesByPlayerId: Record<string, Partial<PlayerStats>> },
    ) => void;
    restoreEnergy: (
      ctx: AirJamActionContext,
      payload: { playerId: string; amount: number },
    ) => void;
    restoreBoredom: (
      ctx: AirJamActionContext,
      payload: { playerId: string; amount: number },
    ) => void;
    killPlayer: (
      ctx: AirJamActionContext,
      payload: { playerId: string },
    ) => void;
  };
}
