import { create, type StoreApi } from "zustand";
import type {
  ConnectionRole,
  ConnectionStatus,
  ControllerOrientation,
  GameState,
  HostArcadeSessionSnapshot,
  PlayerProfile,
  RunMode,
} from "../protocol";

export interface HostArcadeRestoreState {
  phase: "idle" | "awaiting_ack" | "pending_restore";
  session: HostArcadeSessionSnapshot | null;
}

export interface AirJamStore {
  role: ConnectionRole | null;
  roomId: string | null;
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  mode: RunMode;
  gameState: GameState;
  controllerOrientation: ControllerOrientation;
  stateMessage?: string;
  players: PlayerProfile[];
  lastError?: string;
  registeredRoomId: string | null;
  /**
   * Host-only reconnect restore seam used during `host:reconnect`.
   * - `awaiting_ack`: reconnect ack is in flight, so arcade shell broadcast must stay suppressed
   * - `pending_restore`: reconnect ack returned an active arcade session and the platform has not
   *   consumed it yet
   * - `idle`: no reconnect restoration is in progress
   */
  hostArcadeRestore: HostArcadeRestoreState;
  setHostArcadeRestore: (next: HostArcadeRestoreState) => void;
  clearHostArcadeRestore: () => void;
  setRole: (role: ConnectionRole | null) => void;
  setRoomId: (roomId: string | null) => void;
  setControllerId: (controllerId: string | null) => void;
  setStatus: (status: ConnectionStatus) => void;
  setMode: (mode: RunMode) => void;
  setGameState: (state: GameState) => void;
  setControllerOrientation: (orientation: ControllerOrientation) => void;
  setStateMessage: (message?: string) => void;
  toggleGameState: () => void;
  setError: (message?: string) => void;
  upsertPlayer: (player: PlayerProfile) => void;
  removePlayer: (playerId: string) => void;
  resetPlayers: () => void;
  resetGameState: () => void;
  setRegisteredRoomId: (roomId: string | null) => void;
}

/**
 * Factory function to create a new AirJamStore instance.
 * Each AirJamProvider creates its own store for multi-instance support.
 */
export const createAirJamStore = (): StoreApi<AirJamStore> =>
  create<AirJamStore>((set) => ({
    role: null,
    roomId: null,
    controllerId: null,
    connectionStatus: "idle",
    mode: "standalone",
    gameState: "paused",
    controllerOrientation: "portrait",
    stateMessage: undefined,
    players: [],
    lastError: undefined,
    registeredRoomId: null,
    hostArcadeRestore: {
      phase: "idle",
      session: null,
    },
    setHostArcadeRestore: (next) => set({ hostArcadeRestore: next }),
    clearHostArcadeRestore: () =>
      set({
        hostArcadeRestore: {
          phase: "idle",
          session: null,
        },
      }),
    setRole: (role) => set({ role }),
    setRoomId: (roomId) => set({ roomId }),
    setControllerId: (controllerId) => set({ controllerId }),
    setStatus: (connectionStatus) => set({ connectionStatus }),
    setMode: (mode) => set({ mode }),
    setGameState: (gameState) => set({ gameState }),
    setControllerOrientation: (controllerOrientation) =>
      set({ controllerOrientation }),
    setStateMessage: (stateMessage) => set({ stateMessage }),
    toggleGameState: () =>
      set((state) => ({
        gameState: state.gameState === "paused" ? "playing" : "paused",
      })),
    setError: (message) => set({ lastError: message }),
    upsertPlayer: (player) =>
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
      }),
    removePlayer: (playerId) =>
      set((state) => ({
        players: state.players.filter((player) => player.id !== playerId),
      })),
    resetPlayers: () => set({ players: [] }),
    resetGameState: () =>
      set({
        gameState: "paused",
        controllerOrientation: "portrait",
        stateMessage: undefined,
      }),
    setRegisteredRoomId: (roomId) => set({ registeredRoomId: roomId }),
  }));
