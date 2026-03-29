import {
  getMatchReadiness,
} from "../domain/match-readiness";
import { type TeamId } from "../domain/team";
import {
  clampBotCount,
  createEmptyBotCounts,
  getTeamCounts,
  getTeamHumanCount,
  normalizeTeamAssignments,
  type BotCounts,
} from "../domain/team-slots";
import type { PongState, TeamAssignment } from "./pong-store-types";

export const createInitialPongState = (): Omit<PongState, "actions"> => ({
  scores: { team1: 0, team2: 0 },
  matchPhase: "lobby",
  botCounts: createEmptyBotCounts(),
  pointsToWin: 5,
  matchSummary: null,
  matchStartedAtMs: null,
  teamAssignments: {},
});

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

const pruneDisconnectedAssignments = (
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

export const reduceJoinTeam = (
  state: PongState,
  {
    actorId,
    connectedPlayerIds,
    team,
  }: {
    actorId?: string;
    connectedPlayerIds: string[];
    team: TeamId;
  },
): Partial<PongState> | PongState => {
  const playerId = actorId;
  if (!playerId || state.matchPhase !== "lobby") {
    return state;
  }

  const connectedSet = toConnectedPlayerIdSet(connectedPlayerIds, playerId);
  const prunedAssignments = normalizeTeamAssignments(
    pruneDisconnectedAssignments(state.teamAssignments, connectedSet),
  );
  const newAssignments = { ...prunedAssignments };
  const currentAssignment = newAssignments[playerId];

  if (currentAssignment && currentAssignment.team === team) {
    if (prunedAssignments === state.teamAssignments) {
      return state;
    }
    return { teamAssignments: prunedAssignments };
  }

  if (currentAssignment && currentAssignment.team !== team) {
    delete newAssignments[playerId];
  }

  const normalizedAssignments = normalizeTeamAssignments(newAssignments);
  const humanCount = getTeamHumanCount(normalizedAssignments, team);
  const totalOccupancy = humanCount + state.botCounts[team];

  if (totalOccupancy >= 2) {
    if (prunedAssignments === state.teamAssignments) {
      return state;
    }
    return { teamAssignments: prunedAssignments };
  }

  newAssignments[playerId] = {
    team,
    position: humanCount === 0 ? "front" : "back",
  };

  return { teamAssignments: normalizeTeamAssignments(newAssignments) };
};

export const reduceSetPointsToWin = (
  state: PongState,
  pointsToWin: number,
): Partial<PongState> | PongState => {
  if (state.matchPhase !== "lobby") {
    return state;
  }

  const clamped = Math.max(1, Math.min(21, Math.round(pointsToWin)));
  if (state.pointsToWin === clamped) {
    return state;
  }

  return { pointsToWin: clamped };
};

export const reduceSetBotCount = (
  state: PongState,
  {
    connectedPlayerIds,
    team,
    count,
  }: {
    connectedPlayerIds: string[];
    team: TeamId;
    count: number;
  },
): Partial<PongState> | PongState => {
  if (state.matchPhase !== "lobby") {
    return state;
  }

  const connectedSet = toConnectedPlayerIdSet(connectedPlayerIds);
  const teamAssignments = normalizeTeamAssignments(
    pruneDisconnectedAssignments(state.teamAssignments, connectedSet),
  );
  const nextCount = Math.min(
    Math.max(0, MAX_BOTS_FOR_TEAM(teamAssignments, team, count)),
    2,
  );
  const nextBotCounts: BotCounts = {
    ...state.botCounts,
    [team]: nextCount,
  };

  if (
    state.botCounts[team] === nextCount &&
    teamAssignments === state.teamAssignments
  ) {
    return state;
  }

  return {
    botCounts: nextBotCounts,
    teamAssignments,
  };
};

const MAX_BOTS_FOR_TEAM = (
  assignments: Record<string, TeamAssignment>,
  team: TeamId,
  requestedCount: number,
): number => {
  const humanCount = getTeamHumanCount(assignments, team);
  return Math.min(2 - humanCount, clampBotCount(requestedCount));
};

export const reduceStartMatch = (
  state: PongState,
  connectedPlayerIds: string[],
): Partial<PongState> | PongState => {
  if (state.matchPhase !== "lobby") {
    return state;
  }

  const connectedSet = toConnectedPlayerIdSet(connectedPlayerIds);
  const teamAssignments = pruneDisconnectedAssignments(
    state.teamAssignments,
    connectedSet,
  );
  const assignments = Object.values(teamAssignments);
  const teamCounts = getTeamCounts(assignments);
  const { canStart } = getMatchReadiness(teamCounts, state.botCounts);

  if (!canStart) {
    if (teamAssignments === state.teamAssignments) {
      return state;
    }
    return { teamAssignments };
  }

  return {
    scores: { team1: 0, team2: 0 },
    matchPhase: "playing",
    matchSummary: null,
    matchStartedAtMs: Date.now(),
    teamAssignments,
  };
};

export const reduceRestartMatch = (
  state: PongState,
): Partial<PongState> | PongState => {
  if (state.matchPhase !== "ended") {
    return state;
  }

  return {
    scores: { team1: 0, team2: 0 },
    matchPhase: "playing",
    matchSummary: null,
    matchStartedAtMs: Date.now(),
  };
};

export const reduceReturnToLobby = (state: PongState): Partial<PongState> => ({
  scores: { team1: 0, team2: 0 },
  matchPhase: "lobby",
  matchSummary: null,
  matchStartedAtMs: null,
  pointsToWin: state.pointsToWin,
});

export const reduceScorePoint = (
  state: PongState,
  team: TeamId,
): Partial<PongState> | PongState => {
  if (state.matchPhase !== "playing") {
    return state;
  }

  const nextScores = {
    ...state.scores,
    [team]: state.scores[team] + 1,
  };
  const didWin = nextScores[team] >= state.pointsToWin;

  if (!didWin) {
    return { scores: nextScores };
  }

  const durationMs = state.matchStartedAtMs
    ? Math.max(0, Date.now() - state.matchStartedAtMs)
    : 0;

  return {
    scores: nextScores,
    matchPhase: "ended",
    matchStartedAtMs: null,
    matchSummary: {
      winner: team,
      finalScores: nextScores,
      durationMs,
      pointsToWin: state.pointsToWin,
    },
  };
};
