import type { PlayerProfile } from "@air-jam/sdk";
import { create } from "zustand";
import { TEAM_CONFIG, type TeamId } from "../../domain/team";
import { useCaptureTheFlagStore } from "../match/capture-the-flag-store";
import { useHealthStore } from "./health-store";
import { usePlayerStatsStore } from "./player-stats-store";

type PlayerSource = "connected" | "bot";

export interface PlayerSlot {
  controllerId: string;
  profile: PlayerProfile;
  color: string;
  teamId: TeamId;
  source: PlayerSource;
}

export type CameraMode = "follow" | "topdown";

interface GameState {
  players: PlayerSlot[];
  roundId: number;
  cameraMode: CameraMode;
  bumpRound: () => void;
  setCameraMode: (mode: CameraMode) => void;
  upsertConnectedPlayer: (profile: PlayerProfile, controllerId: string) => void;
  removeConnectedPlayer: (controllerId: string) => void;
  upsertBotPlayer: (profile: PlayerProfile, controllerId: string) => void;
  removeBotPlayer: (controllerId: string) => void;
  setPlayerTeam: (controllerId: string, teamId: TeamId) => void;
}

const cleanupPlayerSystems = (controllerId: string) => {
  useHealthStore.getState().removeHealth(controllerId);
  usePlayerStatsStore.getState().removeStats(controllerId);
  useCaptureTheFlagStore.getState().removePlayer(controllerId);
};

export const useGameStore = create<GameState>((set) => ({
  players: [],
  roundId: 0,
  cameraMode: "follow",
  bumpRound: () =>
    set((state) => ({
      roundId: state.roundId + 1,
    })),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  upsertConnectedPlayer: (profile, controllerId) => {
    set((state) => {
      const existing = state.players.find(
        (player) => player.controllerId === controllerId,
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
                    source: "connected",
                  }
                : player,
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
        source: "connected",
      };
      // Initialize health and stats for new player
      useHealthStore.getState().initializeHealth(controllerId);
      usePlayerStatsStore.getState().initializeStats(controllerId);
      return { players: [...state.players, slot] };
    });
  },
  removeConnectedPlayer: (controllerId) => {
    let removed = false;
    set((state) => {
      const target = state.players.find(
        (player) => player.controllerId === controllerId,
      );
      if (!target || target.source !== "connected") {
        return state;
      }
      removed = true;
      return {
        players: state.players.filter(
          (player) => player.controllerId !== controllerId,
        ),
      };
    });

    if (removed) {
      cleanupPlayerSystems(controllerId);
    }
  },
  upsertBotPlayer: (profile, controllerId) => {
    set((state) => {
      const existing = state.players.find(
        (player) => player.controllerId === controllerId,
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
                    source: "bot",
                  }
                : player,
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
        source: "bot",
      };
      useHealthStore.getState().initializeHealth(controllerId);
      usePlayerStatsStore.getState().initializeStats(controllerId);

      return { players: [...state.players, slot] };
    });
  },
  removeBotPlayer: (controllerId) => {
    let removed = false;
    set((state) => {
      const target = state.players.find(
        (player) => player.controllerId === controllerId,
      );
      if (!target || target.source !== "bot") {
        return state;
      }
      removed = true;
      return {
        players: state.players.filter(
          (player) => player.controllerId !== controllerId,
        ),
      };
    });

    if (removed) {
      cleanupPlayerSystems(controllerId);
    }
  },
  setPlayerTeam: (controllerId, teamId) => {
    useCaptureTheFlagStore.getState().setPlayerTeam(controllerId, teamId);

    set((state) => {
      const target = state.players.find(
        (player) => player.controllerId === controllerId,
      );
      if (!target) {
        return state;
      }

      if (target.teamId === teamId) {
        return state;
      }

      return {
        players: state.players.map((player): PlayerSlot => {
          if (player.controllerId !== controllerId) {
            return player;
          }

          return {
            ...player,
            teamId,
            color: TEAM_CONFIG[teamId].color,
          };
        }),
      };
    });
  },
}));
