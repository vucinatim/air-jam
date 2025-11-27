import { create } from "zustand";
import type { ControllerInputEvent, PlayerProfile } from "@air-jam/sdk";
import { useHealthStore } from "./health-store";
import { usePlayerStatsStore } from "./player-stats-store";
import { useInputStore } from "./input-store";
import {
  TEAM_CONFIG,
  type TeamId,
  useCaptureTheFlagStore,
} from "./capture-the-flag-store";

export interface PlayerSlot {
  controllerId: string;
  profile: PlayerProfile;
  color: string;
  teamId: TeamId;
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
        const ctfStore = useCaptureTheFlagStore.getState();
        const teamId =
          ctfStore.getPlayerTeam(controllerId) ?? existing.teamId ?? "solaris";
        return {
          players: state.players.map(
            (player): PlayerSlot =>
              player.controllerId === controllerId
                ? {
                    ...player,
                    profile,
                    teamId,
                    color: TEAM_CONFIG[teamId].color,
                  }
                : player
          ),
        };
      }

      if (state.players.length >= 4) {
        return state;
      }

      const ctfStore = useCaptureTheFlagStore.getState();
      const teamId = ctfStore.assignPlayerToTeam(controllerId);
      const color = TEAM_CONFIG[teamId].color;
      const slot: PlayerSlot = {
        controllerId,
        profile,
        color,
        teamId,
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
    useCaptureTheFlagStore.getState().removePlayer(controllerId);
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
