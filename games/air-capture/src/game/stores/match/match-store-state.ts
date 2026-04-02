import {
  createEmptyTeamCounts,
  getMatchReadiness,
  getTeamCounts,
  type TeamCounts,
} from "../../domain/match-readiness";
import { TEAM_IDS, type TeamId } from "../../domain/team";
import {
  MAX_TEAM_SLOTS,
  clampBotCount,
  getMaxBotsForTeam,
} from "../../domain/team-slots";
import type {
  MatchActionContext,
  MatchStateSnapshot,
  MatchSummary,
  TeamAssignment,
} from "./match-store-types";

export const MATCH_COUNTDOWN_DURATION_MS = 3_000;

const toConnectedPlayerIdSet = (
  connectedPlayerIds: string[],
  actorId?: string,
): Set<string> => {
  const connectedSet = new Set(connectedPlayerIds);
  if (actorId) {
    connectedSet.add(actorId);
  }
  return connectedSet;
};

export const createInitialMatchState = (): MatchStateSnapshot => ({
  matchPhase: "lobby",
  pointsToWin: 3,
  botCounts: createEmptyTeamCounts(),
  teamAssignments: {},
  matchSummary: null,
  countdownEndsAtMs: null,
  matchStartedAtMs: null,
});

export const pruneDisconnectedAssignments = (
  assignments: Record<string, TeamAssignment>,
  connectedSet: Set<string>,
): Record<string, TeamAssignment> => {
  let changed = false;
  const nextAssignments: Record<string, TeamAssignment> = {};

  Object.entries(assignments).forEach(([playerId, assignment]) => {
    if (connectedSet.has(playerId)) {
      nextAssignments[playerId] = assignment;
      return;
    }
    changed = true;
  });

  return changed ? nextAssignments : assignments;
};

export const getHumanCounts = (
  assignments: Record<string, TeamAssignment>,
): TeamCounts => {
  return getTeamCounts(Object.values(assignments));
};

const getEffectiveCountForTeam = (
  humanCounts: TeamCounts,
  botCounts: TeamCounts,
  teamId: TeamId,
): number => {
  return humanCounts[teamId] + botCounts[teamId];
};

export const isTeamFull = (
  humanCounts: TeamCounts,
  botCounts: TeamCounts,
  teamId: TeamId,
): boolean => {
  return (
    getEffectiveCountForTeam(humanCounts, botCounts, teamId) >= MAX_TEAM_SLOTS
  );
};

export const clampBotCounts = (
  botCounts: TeamCounts,
  humanCounts: TeamCounts,
): TeamCounts => {
  return TEAM_IDS.reduce((acc, teamId) => {
    const maxBotsForTeam = getMaxBotsForTeam(humanCounts[teamId]);
    acc[teamId] = Math.min(maxBotsForTeam, clampBotCount(botCounts[teamId]));
    return acc;
  }, createEmptyTeamCounts());
};

export const autoAssignTeam = (
  assignments: Record<string, TeamAssignment>,
  botCounts: TeamCounts,
): TeamId | null => {
  const humanCounts = getHumanCounts(assignments);
  const sortedTeams = TEAM_IDS.slice().sort((a, b) => {
    return (
      getEffectiveCountForTeam(humanCounts, botCounts, a) -
      getEffectiveCountForTeam(humanCounts, botCounts, b)
    );
  });

  for (const teamId of sortedTeams) {
    if (!isTeamFull(humanCounts, botCounts, teamId)) {
      return teamId;
    }
  }

  return null;
};

export const ensureAssignments = (
  assignments: Record<string, TeamAssignment>,
  connectedSet: Set<string>,
  botCounts: TeamCounts,
): Record<string, TeamAssignment> => {
  let changed = false;
  const nextAssignments = { ...assignments };

  Array.from(connectedSet).forEach((playerId) => {
    if (nextAssignments[playerId]) {
      return;
    }

    const targetTeam = autoAssignTeam(nextAssignments, botCounts);
    if (!targetTeam) {
      return;
    }

    nextAssignments[playerId] = { teamId: targetTeam };
    changed = true;
  });

  return changed ? nextAssignments : assignments;
};

export const areTeamCountsEqual = (a: TeamCounts, b: TeamCounts): boolean => {
  return TEAM_IDS.every((teamId) => a[teamId] === b[teamId]);
};

export const reduceSyncConnectedPlayers = (
  state: MatchStateSnapshot,
  { connectedPlayerIds = [] }: MatchActionContext,
): MatchStateSnapshot => {
  const connectedSet = toConnectedPlayerIdSet(connectedPlayerIds);
  const prunedAssignments = pruneDisconnectedAssignments(
    state.teamAssignments,
    connectedSet,
  );
  const completedAssignments = ensureAssignments(
    prunedAssignments,
    connectedSet,
    state.botCounts,
  );

  const humanCounts = getHumanCounts(completedAssignments);
  const normalizedBotCounts = clampBotCounts(state.botCounts, humanCounts);

  if (
    completedAssignments === state.teamAssignments &&
    areTeamCountsEqual(normalizedBotCounts, state.botCounts)
  ) {
    return state;
  }

  return {
    ...state,
    teamAssignments: completedAssignments,
    botCounts: normalizedBotCounts,
  };
};

export const reduceJoinTeam = (
  state: MatchStateSnapshot,
  { actorId, connectedPlayerIds = [] }: MatchActionContext,
  { teamId }: { teamId: TeamId },
): MatchStateSnapshot => {
  if (state.matchPhase !== "lobby" || !actorId) {
    return state;
  }

  const connectedSet = toConnectedPlayerIdSet(connectedPlayerIds, actorId);
  const prunedAssignments = pruneDisconnectedAssignments(
    state.teamAssignments,
    connectedSet,
  );
  const nextAssignments = { ...prunedAssignments };
  const currentAssignment = nextAssignments[actorId];

  if (currentAssignment?.teamId === teamId) {
    if (prunedAssignments === state.teamAssignments) {
      return state;
    }
    return {
      ...state,
      teamAssignments: prunedAssignments,
    };
  }

  if (currentAssignment) {
    delete nextAssignments[actorId];
  }

  const humanCountsWithoutActor = getHumanCounts(nextAssignments);
  if (isTeamFull(humanCountsWithoutActor, state.botCounts, teamId)) {
    if (prunedAssignments === state.teamAssignments) {
      return state;
    }
    return {
      ...state,
      teamAssignments: prunedAssignments,
    };
  }

  nextAssignments[actorId] = { teamId };

  return {
    ...state,
    teamAssignments: nextAssignments,
  };
};

export const reduceSetBotCount = (
  state: MatchStateSnapshot,
  { connectedPlayerIds = [], role }: MatchActionContext,
  { teamId, count }: { teamId: TeamId; count: number },
): MatchStateSnapshot => {
  const canAdjustBots =
    state.matchPhase === "lobby" ||
    (state.matchPhase === "playing" && role === "host");
  if (!canAdjustBots) {
    return state;
  }

  const connectedSet = toConnectedPlayerIdSet(connectedPlayerIds);
  const prunedAssignments = pruneDisconnectedAssignments(
    state.teamAssignments,
    connectedSet,
  );
  const completedAssignments = ensureAssignments(
    prunedAssignments,
    connectedSet,
    state.botCounts,
  );
  const humanCounts = getHumanCounts(completedAssignments);

  const maxBotsForTeam = getMaxBotsForTeam(humanCounts[teamId]);
  const clampedRequested = Math.min(maxBotsForTeam, clampBotCount(count));

  const proposedBotCounts: TeamCounts = {
    ...state.botCounts,
    [teamId]: clampedRequested,
  };

  const normalizedBotCounts = clampBotCounts(proposedBotCounts, humanCounts);

  if (
    completedAssignments === state.teamAssignments &&
    areTeamCountsEqual(normalizedBotCounts, state.botCounts)
  ) {
    return state;
  }

  return {
    ...state,
    teamAssignments: completedAssignments,
    botCounts: normalizedBotCounts,
  };
};

export const reduceSetPointsToWin = (
  state: MatchStateSnapshot,
  { pointsToWin }: { pointsToWin: number },
): MatchStateSnapshot => {
  if (state.matchPhase !== "lobby") {
    return state;
  }

  const clamped = Math.max(1, Math.min(10, Math.round(pointsToWin)));
  if (clamped === state.pointsToWin) {
    return state;
  }

  return {
    ...state,
    pointsToWin: clamped,
  };
};

export const reduceStartMatch = (
  state: MatchStateSnapshot,
  { connectedPlayerIds = [] }: MatchActionContext,
): MatchStateSnapshot => {
  if (state.matchPhase !== "lobby") {
    return state;
  }

  const connectedSet = toConnectedPlayerIdSet(connectedPlayerIds);
  const prunedAssignments = pruneDisconnectedAssignments(
    state.teamAssignments,
    connectedSet,
  );
  const completedAssignments = ensureAssignments(
    prunedAssignments,
    connectedSet,
    state.botCounts,
  );
  const humanCounts = getHumanCounts(completedAssignments);
  const normalizedBotCounts = clampBotCounts(state.botCounts, humanCounts);

  const readiness = getMatchReadiness(humanCounts, normalizedBotCounts);

  if (!readiness.canStart) {
    if (
      completedAssignments === state.teamAssignments &&
      areTeamCountsEqual(normalizedBotCounts, state.botCounts)
    ) {
      return state;
    }

    return {
      ...state,
      teamAssignments: completedAssignments,
      botCounts: normalizedBotCounts,
    };
  }

  return {
    ...state,
    matchPhase: "countdown",
    teamAssignments: completedAssignments,
    botCounts: normalizedBotCounts,
    matchSummary: null,
    countdownEndsAtMs: Date.now() + MATCH_COUNTDOWN_DURATION_MS,
    matchStartedAtMs: null,
  };
};

export const reduceFinishCountdown = (
  state: MatchStateSnapshot,
): MatchStateSnapshot => {
  if (state.matchPhase !== "countdown") {
    return state;
  }

  return {
    ...state,
    matchPhase: "playing",
    countdownEndsAtMs: null,
    matchStartedAtMs: Date.now(),
  };
};

export const reduceRestartMatch = (
  state: MatchStateSnapshot,
): MatchStateSnapshot => {
  if (state.matchPhase !== "ended") {
    return state;
  }

  return {
    ...state,
    matchPhase: "countdown",
    matchSummary: null,
    countdownEndsAtMs: Date.now() + MATCH_COUNTDOWN_DURATION_MS,
    matchStartedAtMs: null,
  };
};

export const reduceReturnToLobby = (
  state: MatchStateSnapshot,
): MatchStateSnapshot => {
  return {
    ...state,
    matchPhase: "lobby",
    countdownEndsAtMs: null,
    matchSummary: null,
    matchStartedAtMs: null,
  };
};

export const reduceEndMatch = (
  state: MatchStateSnapshot,
  {
    winner,
    finalScores,
  }: {
    winner: TeamId;
    finalScores: Record<TeamId, number>;
  },
): MatchStateSnapshot => {
  if (state.matchPhase !== "playing") {
    return state;
  }

  const durationMs = state.matchStartedAtMs
    ? Math.max(0, Date.now() - state.matchStartedAtMs)
    : 0;

  const matchSummary: MatchSummary = {
    winner,
    finalScores,
    pointsToWin: state.pointsToWin,
    durationMs,
  };

  return {
    ...state,
    matchPhase: "ended",
    countdownEndsAtMs: null,
    matchStartedAtMs: null,
    matchSummary,
  };
};
