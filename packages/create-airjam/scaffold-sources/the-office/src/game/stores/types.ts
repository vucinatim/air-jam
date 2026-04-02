import { type AirJamActionContext } from "@air-jam/sdk";

export interface PlayerPosition {
  x: number;
  y: number;
}

export interface PlayerStats {
  energy: number;
  boredom: number;
  alive: boolean;
}

export interface SpaceGameState {
  money: Record<string, number>;
  totalMoneyPenalty: number;
  gameStartTime: number;
  gameDurationMs: number;
  playerPositions: Record<string, PlayerPosition>;
  playerAssignments: Record<string, string>;
  busyPlayers: Record<string, string>;
  taskProgress: Record<string, number>;
  playerStats: Record<string, PlayerStats>;
  gameOver: boolean;
  actions: {
    syncConnectedPlayers: (
      ctx: AirJamActionContext,
      payload: { connectedPlayerIds: string[] },
    ) => void;
    completeTask: (
      ctx: AirJamActionContext,
      payload: { playerId: string; reward: number },
    ) => void;
    applyPenalty: (
      ctx: AirJamActionContext,
      payload: { amount: number },
    ) => void;
    resetGame: (
      ctx: AirJamActionContext,
      _payload: undefined,
    ) => void;
    assignPlayer: (
      ctx: AirJamActionContext,
      payload: { controllerId: string; playerId: string },
    ) => void;
    setBusy: (
      ctx: AirJamActionContext,
      payload: { playerId: string; taskName: string | null },
    ) => void;
    setTaskProgress: (
      ctx: AirJamActionContext,
      payload: { playerId: string; progress: number },
    ) => void;
    updatePlayerStats: (
      ctx: AirJamActionContext,
      payload: { playerId: string; updates: Partial<PlayerStats> },
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
    setGameOver: (
      ctx: AirJamActionContext,
      payload: { gameOver: boolean },
    ) => void;
    setGameStartTime: (
      ctx: AirJamActionContext,
      payload: { startTime: number },
    ) => void;
  };
}
