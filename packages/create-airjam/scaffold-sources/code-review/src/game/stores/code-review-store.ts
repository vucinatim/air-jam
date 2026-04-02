import { createAirJamStore } from "@air-jam/sdk";
import {
  assignmentsEqual,
  canJoinTeam,
  normalizeAssignments,
  pruneDisconnectedAssignments,
} from "../domain/team-assignments";
import type { CodeReviewGameState } from "./code-review-store-types";

export const useGameStore = createAirJamStore<CodeReviewGameState>((set) => ({
  scores: { team1: 0, team2: 0 },
  teamAssignments: {},

  actions: {
    syncConnectedPlayers: ({ role }, { connectedPlayerIds }) =>
      set((state) => {
        if (role !== "host") {
          return state;
        }

        const nextAssignments = pruneDisconnectedAssignments(
          state.teamAssignments,
          connectedPlayerIds,
        );

        if (assignmentsEqual(nextAssignments, state.teamAssignments)) {
          return state;
        }

        return {
          teamAssignments: nextAssignments,
        };
      }),

    joinTeam: ({ actorId, connectedPlayerIds }, { team }) =>
      set((state) => {
        if (!actorId) {
          return state;
        }

        const currentAssignments = pruneDisconnectedAssignments(
          state.teamAssignments,
          connectedPlayerIds,
          actorId,
        );
        const currentAssignment = currentAssignments[actorId];

        if (currentAssignment?.team === team) {
          if (assignmentsEqual(currentAssignments, state.teamAssignments)) {
            return state;
          }

          return {
            teamAssignments: currentAssignments,
          };
        }

        const nextAssignments = { ...currentAssignments };
        delete nextAssignments[actorId];

        if (!canJoinTeam(nextAssignments, team)) {
          if (assignmentsEqual(currentAssignments, state.teamAssignments)) {
            return state;
          }

          return {
            teamAssignments: currentAssignments,
          };
        }

        nextAssignments[actorId] = { team, position: "front" };
        return {
          teamAssignments: normalizeAssignments(nextAssignments),
        };
      }),

    resetGame: ({ role }) =>
      set((state) => {
        if (role !== "host") {
          return state;
        }

        return {
          scores: { team1: 0, team2: 0 },
          teamAssignments: {},
        };
      }),

    scorePoint: ({ role }, { team }) =>
      set((state) => {
        if (role !== "host") {
          return state;
        }

        return {
          scores: {
            ...state.scores,
            [team]: state.scores[team] + 1,
          },
        };
      }),
  },
}));
