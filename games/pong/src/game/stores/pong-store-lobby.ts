import { getMatchReadiness } from "../domain/match-readiness";
import { type TeamId } from "../domain/team";
import {
  clampBotCount,
  getTeamCounts,
  getTeamHumanCount,
  normalizeTeamAssignments,
  type BotCounts,
} from "../domain/team-slots";
import type { PongState, TeamAssignment } from "./pong-store-types";

const MAX_TEAM_SLOTS = 2;

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

const getMaxBotsForTeam = (
  assignments: Record<string, TeamAssignment>,
  team: TeamId,
  requestedCount: number,
): number => {
  const humanCount = getTeamHumanCount(assignments, team);
  return Math.min(MAX_TEAM_SLOTS - humanCount, clampBotCount(requestedCount));
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

  if (currentAssignment?.team === team) {
    return prunedAssignments === state.teamAssignments
      ? state
      : { teamAssignments: prunedAssignments };
  }

  if (currentAssignment) {
    delete newAssignments[playerId];
  }

  const normalizedAssignments = normalizeTeamAssignments(newAssignments);
  const humanCount = getTeamHumanCount(normalizedAssignments, team);
  const totalOccupancy = humanCount + state.botCounts[team];

  if (totalOccupancy >= MAX_TEAM_SLOTS) {
    return prunedAssignments === state.teamAssignments
      ? state
      : { teamAssignments: prunedAssignments };
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
  return state.pointsToWin === clamped ? state : { pointsToWin: clamped };
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
    Math.max(0, getMaxBotsForTeam(teamAssignments, team, count)),
    MAX_TEAM_SLOTS,
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
  const teamCounts = getTeamCounts(Object.values(teamAssignments));
  const { canStart } = getMatchReadiness(teamCounts, state.botCounts);

  if (!canStart) {
    return teamAssignments === state.teamAssignments
      ? state
      : { teamAssignments };
  }

  return {
    scores: { team1: 0, team2: 0 },
    matchPhase: "playing",
    matchSummary: null,
    matchStartedAtMs: Date.now(),
    teamAssignments,
  };
};
