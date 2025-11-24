import { create } from "zustand";
import type { ControllerInputEvent, PlayerProfile } from "@air-jam/sdk";
import { useHealthStore } from "./health-store";

export interface InputState {
  vector: { x: number; y: number };
  action: boolean;
  ability: boolean;
  timestamp: number;
}

export interface PlayerSlot {
  controllerId: string;
  profile: PlayerProfile;
  color: string;
  input: InputState;
}

export type CameraMode = "follow" | "topdown";

interface GameState {
  players: PlayerSlot[];
  cameraMode: CameraMode;
  setCameraMode: (mode: CameraMode) => void;
  upsertPlayer: (profile: PlayerProfile, controllerId: string) => void;
  removePlayer: (controllerId: string) => void;
  applyInput: (event: ControllerInputEvent) => void;
  clearInputs: () => void;
}

const PLAYER_COLORS = ["#38bdf8", "#a78bfa", "#f472b6", "#34d399"];

const createEmptyInput = (): InputState => ({
  vector: { x: 0, y: 0 },
  action: false,
  ability: false,
  timestamp: Date.now(),
});

export const useGameStore = create<GameState>((set) => ({
  players: [],
  cameraMode: "follow",
  setCameraMode: (mode) => set({ cameraMode: mode }),
  upsertPlayer: (profile, controllerId) => {
    set((state) => {
      const existing = state.players.find(
        (player) => player.controllerId === controllerId
      );
      if (existing) {
        return {
          players: state.players.map(
            (player): PlayerSlot =>
              player.controllerId === controllerId
                ? { ...player, profile }
                : player
          ),
        };
      }

      if (state.players.length >= 4) {
        return state;
      }

      const color = PLAYER_COLORS[state.players.length % PLAYER_COLORS.length];
      const slot: PlayerSlot = {
        controllerId,
        profile,
        color,
        input: createEmptyInput(),
      };
      // Initialize health for new player
      useHealthStore.getState().initializeHealth(controllerId);
      return { players: [...state.players, slot] };
    });
  },
  removePlayer: (controllerId) => {
    set((state) => ({
      players: state.players.filter(
        (player) => player.controllerId !== controllerId
      ),
    }));
    // Clean up health when player is removed
    useHealthStore.getState().removeHealth(controllerId);
  },
  applyInput: (event) => {
    set((state) => ({
      players: state.players.map((player) =>
        player.controllerId === event.controllerId
          ? {
              ...player,
              input: {
                vector: event.input.vector,
                action: event.input.action,
                ability: event.input.ability ?? false,
                timestamp: event.input.timestamp ?? Date.now(),
              },
            }
          : player
      ),
    }));
  },
  clearInputs: () => {
    const now = Date.now();
    set((state) => ({
      players: state.players.map((player) => ({
        ...player,
        input: { ...createEmptyInput(), timestamp: now },
      })),
    }));
  },
}));
