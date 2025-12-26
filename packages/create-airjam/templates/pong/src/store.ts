import { createAirJamStore } from "@air-jam/sdk";

export interface TeamAssignment {
  team: "team1" | "team2";
  position: "front" | "back";
}

export interface PongState {
  scores: { team1: number; team2: number };
  // Map controllerId -> { team, position }
  teamAssignments: Record<string, TeamAssignment>;

  actions: {
    joinTeam: (team: "team1" | "team2", playerId?: string) => void;
    resetGame: () => void;
    scorePoint: (team: "team1" | "team2") => void;
  };
}

// This store is automatically synced between the host and all controllers.
export const usePongStore = createAirJamStore<PongState>((set) => ({
  scores: { team1: 0, team2: 0 },
  teamAssignments: {},

  actions: {
    // Note: playerId is injected by the SDK on the Host side automatically
    joinTeam: (team, playerId) => {
      if (!playerId) return;
      set((state) => {
        const newAssignments = { ...state.teamAssignments };
        const currentAssignment = newAssignments[playerId];

        // If player is already on this team, don't change anything
        if (currentAssignment && currentAssignment.team === team) {
          return state;
        }

        // Remove player from their current team if they're switching
        if (currentAssignment && currentAssignment.team !== team) {
          delete newAssignments[playerId];
        }

        // Count players in the target team (excluding the current player)
        const teamPlayers = Object.values(newAssignments).filter(
          (assignment) => assignment.team === team,
        );

        // Enforce max 2 players per team
        if (teamPlayers.length >= 2) {
          // Team is full, don't allow assignment
          return state;
        }

        // Assign position: first player = front, second = back
        const position: "front" | "back" =
          teamPlayers.length === 0 ? "front" : "back";

        newAssignments[playerId] = { team, position };

        return {
          teamAssignments: newAssignments,
        };
      });
    },

    resetGame: () =>
      set({
        scores: { team1: 0, team2: 0 },
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
