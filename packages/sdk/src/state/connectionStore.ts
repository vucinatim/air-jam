import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type {
  ConnectionRole,
  ConnectionStatus,
  PlayerProfile,
  RunMode,
} from "../protocol";

interface AirJamStore {
  role: ConnectionRole | null;
  roomId: string | null;
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  mode: RunMode;
  players: PlayerProfile[];
  lastError?: string;
  setRole: (role: ConnectionRole | null) => void;
  setRoomId: (roomId: string | null) => void;
  setControllerId: (controllerId: string | null) => void;
  setStatus: (status: ConnectionStatus) => void;
  setMode: (mode: RunMode) => void;
  setError: (message?: string) => void;
  upsertPlayer: (player: PlayerProfile) => void;
  removePlayer: (playerId: string) => void;
  resetPlayers: () => void;
}

export const useConnectionStore = create<AirJamStore>((set) => ({
  role: null,
  roomId: null,
  controllerId: null,
  connectionStatus: "idle",
  mode: "standalone",
  players: [],
  lastError: undefined,
  setRole: (role) => set({ role }),
  setRoomId: (roomId) => set({ roomId }),
  setControllerId: (controllerId) => set({ controllerId }),
  setStatus: (connectionStatus) => set({ connectionStatus }),
  setMode: (mode) => set({ mode }),
  setError: (message) => set({ lastError: message }),
  upsertPlayer: (player) =>
    set((state) => {
      const existingIndex = state.players.findIndex(
        (entry) => entry.id === player.id
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
}));

export const useConnectionState = <T extends Record<string, unknown>>(
  selector: (state: AirJamStore) => T
): T => {
  return useConnectionStore(useShallow(selector));
};
