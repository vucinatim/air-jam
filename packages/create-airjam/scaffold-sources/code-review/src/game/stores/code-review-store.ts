import { createAirJamStore } from "@air-jam/sdk";
import {
  assignmentsEqual,
  normalizeAssignments,
  pruneDisconnectedAssignments,
  type Team,
} from "../domain/team-assignments";
import type { CodeReviewGameState } from "./code-review-store-types";

const MAX_PLAYERS_PER_TEAM = 2;

const botCountsEqual = (
  left: CodeReviewGameState["botCounts"],
  right: CodeReviewGameState["botCounts"],
): boolean => left.team1 === right.team1 && left.team2 === right.team2;

const clampBotCount = (count: number): number =>
  Math.max(0, Math.min(MAX_PLAYERS_PER_TEAM, Math.round(count)));

const getTeamHumanCount = (
  assignments: CodeReviewGameState["teamAssignments"],
  team: Team,
): number =>
  Object.values(assignments).filter((assignment) => assignment.team === team)
    .length;

const clampBotCounts = (
  botCounts: CodeReviewGameState["botCounts"],
  assignments: CodeReviewGameState["teamAssignments"],
): CodeReviewGameState["botCounts"] => ({
  team1: Math.max(
    0,
    Math.min(
      MAX_PLAYERS_PER_TEAM - getTeamHumanCount(assignments, "team1"),
      clampBotCount(botCounts.team1),
    ),
  ),
  team2: Math.max(
    0,
    Math.min(
      MAX_PLAYERS_PER_TEAM - getTeamHumanCount(assignments, "team2"),
      clampBotCount(botCounts.team2),
    ),
  ),
});

export const useGameStore = createAirJamStore<CodeReviewGameState>((set) => ({
  matchPhase: "lobby",
  matchSummary: null,
  scores: { team1: 0, team2: 0 },
  teamAssignments: {},
  botCounts: { team1: 0, team2: 0 },

  actions: {
    startMatch: () =>
      set((state) => {
        if (state.matchPhase === "playing") {
          return state;
        }
        return {
          matchPhase: "playing",
          matchSummary: null,
          scores: { team1: 0, team2: 0 },
        };
      }),

    resetToLobby: () =>
      set((state) => {
        if (
          state.matchPhase === "lobby" &&
          state.matchSummary === null &&
          state.scores.team1 === 0 &&
          state.scores.team2 === 0
        ) {
          return state;
        }
        return {
          matchPhase: "lobby",
          matchSummary: null,
          scores: { team1: 0, team2: 0 },
        };
      }),

    finishMatch: ({ role }) =>
      set((state) => {
        if (role !== "host" || state.matchPhase !== "playing") {
          return state;
        }

        const winner =
          state.scores.team1 === state.scores.team2
            ? "draw"
            : state.scores.team1 > state.scores.team2
              ? "team1"
              : "team2";

        return {
          matchPhase: "ended",
          matchSummary: {
            winner,
            scores: {
              team1: state.scores.team1,
              team2: state.scores.team2,
            },
          },
        };
      }),

    syncConnectedPlayers: ({ role }, { connectedPlayerIds }) =>
      set((state) => {
        if (role !== "host") {
          return state;
        }

        const nextAssignments = pruneDisconnectedAssignments(
          state.teamAssignments,
          connectedPlayerIds,
        );
        const nextBotCounts = clampBotCounts(state.botCounts, nextAssignments);

        if (
          assignmentsEqual(nextAssignments, state.teamAssignments) &&
          botCountsEqual(nextBotCounts, state.botCounts)
        ) {
          return state;
        }

        return {
          teamAssignments: nextAssignments,
          botCounts: nextBotCounts,
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
        const currentBotCounts = clampBotCounts(
          state.botCounts,
          currentAssignments,
        );
        const currentAssignment = currentAssignments[actorId];

        if (currentAssignment?.team === team) {
          if (
            assignmentsEqual(currentAssignments, state.teamAssignments) &&
            botCountsEqual(currentBotCounts, state.botCounts)
          ) {
            return state;
          }

          return {
            teamAssignments: currentAssignments,
            botCounts: currentBotCounts,
          };
        }

        const nextAssignments = { ...currentAssignments };
        delete nextAssignments[actorId];

        const teamOccupancy =
          getTeamHumanCount(nextAssignments, team) + currentBotCounts[team];
        if (teamOccupancy >= MAX_PLAYERS_PER_TEAM) {
          if (
            assignmentsEqual(currentAssignments, state.teamAssignments) &&
            botCountsEqual(currentBotCounts, state.botCounts)
          ) {
            return state;
          }

          return {
            teamAssignments: currentAssignments,
            botCounts: currentBotCounts,
          };
        }

        nextAssignments[actorId] = { team, position: "front" };
        const normalizedAssignments = normalizeAssignments(nextAssignments);
        const nextBotCounts = clampBotCounts(currentBotCounts, normalizedAssignments);
        return {
          teamAssignments: normalizedAssignments,
          botCounts: nextBotCounts,
        };
      }),

    setBotCount: ({ connectedPlayerIds }, { team, count }) =>
      set((state) => {
        const nextAssignments = pruneDisconnectedAssignments(
          state.teamAssignments,
          connectedPlayerIds,
        );
        const nextBotCounts = clampBotCounts(
          {
            ...state.botCounts,
            [team]: count,
          },
          nextAssignments,
        );

        if (
          assignmentsEqual(nextAssignments, state.teamAssignments) &&
          botCountsEqual(nextBotCounts, state.botCounts)
        ) {
          return state;
        }

        return {
          teamAssignments: nextAssignments,
          botCounts: nextBotCounts,
        };
      }),

    resetGame: ({ role }) =>
      set((state) => {
        if (role !== "host") {
          return state;
        }

        return {
          matchPhase: "lobby",
          matchSummary: null,
          scores: { team1: 0, team2: 0 },
          teamAssignments: {},
          botCounts: { team1: 0, team2: 0 },
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
