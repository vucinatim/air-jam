import { create } from "zustand";
import type { ControllerInputEvent, PlayerProfile } from "@air-jam/sdk";
import { useHealthStore } from "./health-store";
import { usePlayerStatsStore } from "./player-stats-store";
import { useInputStore } from "./input-store";

export interface PlayerSlot {
  controllerId: string;
  profile: PlayerProfile;
  color: string;
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
                ? {
                    ...player,
                    profile,
                    // Update color if profile has one
                    color: profile.color || player.color,
                  }
                : player
          ),
        };
      }

      if (state.players.length >= 4) {
        return state;
      }

      // Use color from profile if available, otherwise assign from color array
      const color =
        profile.color ||
        PLAYER_COLORS[state.players.length % PLAYER_COLORS.length];
      const slot: PlayerSlot = {
        controllerId,
        profile,
        color,
      };
      // Initialize health and stats for new player
      useHealthStore.getState().initializeHealth(controllerId);
      usePlayerStatsStore.getState().initializeStats(controllerId);
      // Initialize input for new player (input store will handle empty input creation)
      useInputStore.getState().applyInput({
        controllerId,
        input: {
          vector: { x: 0, y: 0 },
          action: false,
          ability: false,
          timestamp: Date.now(),
        },
      });
      return { players: [...state.players, slot] };
    });
  },
  removePlayer: (controllerId) => {
    set((state) => ({
      players: state.players.filter(
        (player) => player.controllerId !== controllerId
      ),
    }));
    // Clean up health and stats when player is removed
    useHealthStore.getState().removeHealth(controllerId);
    usePlayerStatsStore.getState().removeStats(controllerId);
    // Clean up input when player is removed
    useInputStore.getState().removeInput(controllerId);
  },
  applyInput: (event) => {
    // Update input store instead of players array to avoid unnecessary rerenders
    useInputStore.getState().applyInput(event);
  },
  clearInputs: () => {
    // Clear all inputs in the input store
    useInputStore.getState().clearAllInputs();
  },
}));
