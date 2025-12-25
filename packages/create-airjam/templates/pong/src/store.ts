import { createAirJamStore } from "@air-jam/sdk";

export interface PongState {
  phase: "lobby" | "playing" | "gameover";
  scores: { team1: number; team2: number };
  // Map controllerId -> "team1" | "team2"
  teamAssignments: Record<string, "team1" | "team2">;

  actions: {
    joinTeam: (team: "team1" | "team2", playerId?: string) => void;
    setPhase: (phase: "lobby" | "playing" | "gameover") => void;
    resetGame: () => void;
    scorePoint: (team: "team1" | "team2") => void;
  };
}

export const usePongStore = createAirJamStore<PongState>((set) => ({
  phase: "lobby",
  scores: { team1: 0, team2: 0 },
  teamAssignments: {},

  actions: {
    // Note: playerId is injected by the SDK on the Host side automatically
    joinTeam: (team, playerId) => {
      if (!playerId) return;
      set((state) => ({
        teamAssignments: { ...state.teamAssignments, [playerId]: team },
      }));
    },

    setPhase: (phase) => set({ phase }),

    resetGame: () =>
      set({
        scores: { team1: 0, team2: 0 },
        phase: "lobby",
        teamAssignments: {},
      }),

    scorePoint: (team) =>
      set((state) => ({
        scores: {
          ...state.scores,
          [team]: state.scores[team] + 1,
        },
      })),
  },
}));
