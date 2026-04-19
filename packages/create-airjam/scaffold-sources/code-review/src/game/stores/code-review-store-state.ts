import {
  assignmentsEqual,
  normalizeAssignments,
  pruneDisconnectedAssignments,
  type Team,
} from "../domain/team-assignments";
import type {
  BotCounts,
  CodeReviewGameState,
  CodeReviewMatchSummary,
} from "./code-review-store-types";

const MAX_PLAYERS_PER_TEAM = 2;

const botCountsEqual = (left: BotCounts, right: BotCounts): boolean =>
  left.team1 === right.team1 && left.team2 === right.team2;

const clampBotCount = (count: number): number =>
  Math.max(0, Math.min(MAX_PLAYERS_PER_TEAM, Math.round(count)));

const getTeamHumanCount = (
  assignments: CodeReviewGameState["teamAssignments"],
  team: Team,
): number =>
  Object.values(assignments).filter((assignment) => assignment.team === team)
    .length;

export const clampBotCounts = (
  botCounts: BotCounts,
  assignments: CodeReviewGameState["teamAssignments"],
): BotCounts => ({
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

export const createInitialCodeReviewState = () => ({
  matchPhase: "lobby" as const,
  matchSummary: null,
  scores: { team1: 0, team2: 0 },
  teamAssignments: {},
  botCounts: { team1: 0, team2: 0 },
});

const createMatchSummary = (
  scores: CodeReviewGameState["scores"],
): CodeReviewMatchSummary => ({
  winner:
    scores.team1 === scores.team2
      ? "draw"
      : scores.team1 > scores.team2
        ? "team1"
        : "team2",
  scores: {
    team1: scores.team1,
    team2: scores.team2,
  },
});

export const reduceStartMatch = (state: CodeReviewGameState) => {
  if (state.matchPhase === "playing") {
    return state;
  }

  return {
    matchPhase: "playing" as const,
    matchSummary: null,
    scores: { team1: 0, team2: 0 },
  };
};

export const reduceResetToLobby = (state: CodeReviewGameState) => {
  if (
    state.matchPhase === "lobby" &&
    state.matchSummary === null &&
    state.scores.team1 === 0 &&
    state.scores.team2 === 0
  ) {
    return state;
  }

  return {
    matchPhase: "lobby" as const,
    matchSummary: null,
    scores: { team1: 0, team2: 0 },
  };
};

export const reduceFinishMatch = (state: CodeReviewGameState) => {
  if (state.matchPhase !== "playing") {
    return state;
  }

  return {
    matchPhase: "ended" as const,
    matchSummary: createMatchSummary(state.scores),
  };
};

export const reduceSyncConnectedPlayers = (
  state: CodeReviewGameState,
  connectedPlayerIds: string[],
) => {
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
};

export const reduceJoinTeam = (
  state: CodeReviewGameState,
  actorId: string | undefined,
  connectedPlayerIds: string[],
  team: Team,
) => {
  if (!actorId) {
    return state;
  }

  const currentAssignments = pruneDisconnectedAssignments(
    state.teamAssignments,
    connectedPlayerIds,
    actorId,
  );
  const currentBotCounts = clampBotCounts(state.botCounts, currentAssignments);
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
};

export const reduceSetBotCount = (
  state: CodeReviewGameState,
  connectedPlayerIds: string[],
  team: Team,
  count: number,
) => {
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
};

export const reduceResetGame = () => ({
  ...createInitialCodeReviewState(),
});

export const reduceScorePoint = (state: CodeReviewGameState, team: Team) => ({
  scores: {
    ...state.scores,
    [team]: state.scores[team] + 1,
  },
});
