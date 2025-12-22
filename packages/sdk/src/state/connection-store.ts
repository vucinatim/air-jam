import { create, type StoreApi } from "zustand";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { InputManager } from "../internal/input-manager";
import type {
  ConnectionRole,
  ConnectionStatus,
  GameState,
  PlayerProfile,
  RunMode,
} from "../protocol";

// Type for host options (avoiding circular dependency)
export type HostOptions = {
  roomId?: string;
  input?: unknown;
  onPlayerJoin?: (player: PlayerProfile) => void;
  onPlayerLeave?: (controllerId: string) => void;
  onChildClose?: () => void;
  forceConnect?: boolean;
  apiKey?: string;
  maxPlayers?: number;
};

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
  // Host state (shared across all useAirJamHost calls)
  hostInitialized: boolean;
  inputManager: InputManager | null;
  hostOptions: HostOptions | null;
  registeredRoomId: string | null;
  initializeHost: (options: HostOptions, inputManager: InputManager) => void;
  getHostInputManager: () => InputManager | null;
  setRegisteredRoomId: (roomId: string | null) => void;
}

/**
 * Factory function to create a new AirJamStore instance.
 * Each AirJamProvider creates its own store for multi-instance support.
 */
export const createAirJamStore = (): StoreApi<AirJamStore> =>
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
    setGameState: (gameState) => set({ gameState }),
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
    resetGameState: () => set({ gameState: "paused", stateMessage: undefined }),
    // Host state
    hostInitialized: false,
    inputManager: null,
    hostOptions: null,
    registeredRoomId: null,
    initializeHost: (options, inputManager) => {
      set({
        hostInitialized: true,
        inputManager,
        hostOptions: options,
      });
    },
    getHostInputManager: () => get().inputManager,
    setRegisteredRoomId: (roomId) => set({ registeredRoomId: roomId }),
  }));

// ============================================================================
// Legacy Global Store (deprecated - kept for backwards compatibility)
// New code should use AirJamProvider and useAirJamContext instead
// ============================================================================

/** @deprecated Use AirJamProvider instead */
export const useConnectionStore = createAirJamStore();

/** @deprecated Use useAirJamState from context instead */
export const useConnectionState = <T extends Record<string, unknown>>(
  selector: (state: AirJamStore) => T,
): T => {
  return useStore(useConnectionStore, useShallow(selector));
};
