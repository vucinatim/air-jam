import { createAirJamStore } from "@air-jam/sdk";
import {
  assignmentsEqual,
  normalizeAssignments,
  pruneDisconnectedAssignments,
  type Team,
} from "../domain/team-assignments";
import type { CodeReviewGameState } from "./code-review-store-types";

const MAX_PLAYERS_PER_TEAM = 2;

const readyMapsEqual = (
  a: Record<string, boolean>,
  b: Record<string, boolean>,
): boolean => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => a[key] === b[key]);
};

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
  scores: { team1: 0, team2: 0 },
  teamAssignments: {},
  readyByPlayerId: {},
  botCounts: { team1: 0, team2: 0 },

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
        const connectedSet = new Set(connectedPlayerIds);
        const nextReadyByPlayerId = Object.fromEntries(
          Object.entries(state.readyByPlayerId).filter(([playerId]) =>
            connectedSet.has(playerId),
          ),
        );
        const nextBotCounts = clampBotCounts(state.botCounts, nextAssignments);

        if (
          assignmentsEqual(nextAssignments, state.teamAssignments) &&
          readyMapsEqual(nextReadyByPlayerId, state.readyByPlayerId) &&
          botCountsEqual(nextBotCounts, state.botCounts)
        ) {
          return state;
        }

        return {
          teamAssignments: nextAssignments,
          readyByPlayerId: nextReadyByPlayerId,
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
          readyByPlayerId: {
            ...state.readyByPlayerId,
            [actorId]: false,
          },
          botCounts: nextBotCounts,
        };
      }),

    setReady: ({ actorId }, { ready }) =>
      set((state) => {
        if (!actorId) {
          return state;
        }

        if (!state.teamAssignments[actorId]) {
          return state;
        }

        if ((state.readyByPlayerId[actorId] ?? false) === ready) {
          return state;
        }

        return {
          readyByPlayerId: {
            ...state.readyByPlayerId,
            [actorId]: ready,
          },
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
          scores: { team1: 0, team2: 0 },
          teamAssignments: {},
          readyByPlayerId: {},
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
