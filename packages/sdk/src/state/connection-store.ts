import { create } from "zustand";
import type {
  ConnectionRole,
  ConnectionStatus,
  GameState,
  PlayerProfile,
  RunMode,
} from "../protocol";

export interface AirJamStore {
  role: ConnectionRole | null;
  roomId: string | null;
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  mode: RunMode;
  gameState: GameState;
  stateMessage?: string;
  players: PlayerProfile[];
  lastError?: string;
  setRole: (role: ConnectionRole | null) => void;
  setRoomId: (roomId: string | null) => void;
  setControllerId: (controllerId: string | null) => void;
  setStatus: (status: ConnectionStatus) => void;
  setMode: (mode: RunMode) => void;
  setGameState: (state: GameState) => void;
  setStateMessage: (message?: string) => void;
  toggleGameState: () => void;
  setError: (message?: string) => void;
  upsertPlayer: (player: PlayerProfile) => void;
  removePlayer: (playerId: string) => void;
  resetPlayers: () => void;
  resetGameState: () => void;
}

export type AirJamStoreInstance = ReturnType<typeof createAirJamStore>;

/**
 * Factory to create a new, isolated Air Jam connection store.
 */
export const createAirJamStore = () => 
  create<AirJamStore>((set, get) => ({
    role: null,
    roomId: null,
    controllerId: null,
    connectionStatus: "idle",
    mode: "standalone",
    gameState: "paused",
    stateMessage: undefined,
    players: [],
    lastError: undefined,
    setRole: (role) => set({ role }),
    setRoomId: (roomId) => set({ roomId }),
    setControllerId: (controllerId) => set({ controllerId }),
    setStatus: (connectionStatus) => set({ connectionStatus }),
    setMode: (mode) => set({ mode }),
    setGameState: (gameState) => {
      const currentState = get();
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'connection-store.ts:56',message:'STORE: setGameState called',data:{newGameState:gameState,oldGameState:currentState.gameState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'STORE_UPDATE'})}).catch(()=>{});
      // #endregion
      set({ gameState });
      const newState = get();
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'connection-store.ts:60',message:'STORE: setGameState completed - zustand state updated',data:{newGameState:newState.gameState,oldGameState:currentState.gameState},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'STORE_UPDATE'})}).catch(()=>{});
      // #endregion
    },
    setStateMessage: (stateMessage) => set({ stateMessage }),
    toggleGameState: () =>
      set((state) => ({
        gameState: state.gameState === "paused" ? "playing" : "paused",
      })),
    setError: (message) => set({ lastError: message }),
    upsertPlayer: (player) => {
      const currentState = get();
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'connection-store.ts:73',message:'STORE: upsertPlayer called',data:{playerId:player.id,playerLabel:player.label,oldPlayersCount:currentState.players.length,existingPlayerIndex:currentState.players.findIndex(p=>p.id===player.id)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'STORE_UPSERT_PLAYER'})}).catch(()=>{});
      // #endregion
      set((state) => {
        const existingIndex = state.players.findIndex(
          (entry) => entry.id === player.id,
        );
        if (existingIndex >= 0) {
          const nextPlayers = [...state.players];
          nextPlayers[existingIndex] = player;
          return { players: nextPlayers };
        }
        return { players: [...state.players, player] };
      });
      const newState = get();
      // #region agent log
      fetch('http://127.0.0.1:7245/ingest/77275639-c0f5-41c0-a729-c2568f3ab68e',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'connection-store.ts:84',message:'STORE: upsertPlayer completed - zustand state updated',data:{playerId:player.id,newPlayersCount:newState.players.length,oldPlayersCount:currentState.players.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'STORE_UPSERT_PLAYER'})}).catch(()=>{});
      // #endregion
    },
    removePlayer: (playerId) =>
      set((state) => ({
        players: state.players.filter((player) => player.id !== playerId),
      })),
    resetPlayers: () => set({ players: [] }),
    resetGameState: () => set({ gameState: "paused", stateMessage: undefined }),
  }));
