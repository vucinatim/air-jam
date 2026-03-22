import {
  createAirJamStore,
  type AirJamActionContext,
} from "@air-jam/sdk";
import {
  TEAM_CONFIG,
  type TeamId,
} from "./capture-the-flag-store";
import {
  createEmptyTeamCounts,
  getMatchReadiness,
  getTeamCounts,
  type TeamCounts,
} from "./match-readiness";

const TEAM_IDS = Object.keys(TEAM_CONFIG) as TeamId[];
const MAX_TEAM_SIZE = 2;

export type MatchPhase = "lobby" | "playing" | "ended";

export interface TeamAssignment {
  teamId: TeamId;
}

export interface MatchSummary {
  winner: TeamId;
  finalScores: Record<TeamId, number>;
  pointsToWin: number;
  durationMs: number;
}

interface PrototypeMatchState {
  matchPhase: MatchPhase;
  pointsToWin: number;
  botCounts: TeamCounts;
  teamAssignments: Record<string, TeamAssignment>;
  matchSummary: MatchSummary | null;
  matchStartedAtMs: number | null;

  actions: {
    syncConnectedPlayers: (
      ctx: AirJamActionContext,
      payload: { connectedPlayerIds: string[] },
    ) => void;
    joinTeam: (ctx: AirJamActionContext, payload: { teamId: TeamId }) => void;
    setTeamBotCount: (
      ctx: AirJamActionContext,
      payload: { teamId: TeamId; count: number },
    ) => void;
    setPointsToWin: (
      _ctx: AirJamActionContext,
      payload: { pointsToWin: number },
    ) => void;
    startMatch: (_ctx: AirJamActionContext, _payload: undefined) => void;
    restartMatch: (_ctx: AirJamActionContext, _payload: undefined) => void;
    returnToLobby: (_ctx: AirJamActionContext, _payload: undefined) => void;
    endMatch: (
      _ctx: AirJamActionContext,
      payload: { winner: TeamId; finalScores: Record<TeamId, number> },
    ) => void;
  };
}

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

const getHumanCounts = (
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

const isTeamFull = (
  humanCounts: TeamCounts,
  botCounts: TeamCounts,
  teamId: TeamId,
): boolean => {
  return getEffectiveCountForTeam(humanCounts, botCounts, teamId) >= MAX_TEAM_SIZE;
};

const clampBotCounts = (
  botCounts: TeamCounts,
  humanCounts: TeamCounts,
): TeamCounts => {
  return TEAM_IDS.reduce(
    (acc, teamId) => {
      const maxBotsForTeam = Math.max(0, MAX_TEAM_SIZE - humanCounts[teamId]);
      acc[teamId] = Math.max(0, Math.min(maxBotsForTeam, botCounts[teamId]));
      return acc;
    },
    createEmptyTeamCounts(),
  );
};

const autoAssignTeam = (
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

const ensureAssignments = (
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

const areTeamCountsEqual = (a: TeamCounts, b: TeamCounts): boolean => {
  return TEAM_IDS.every((teamId) => a[teamId] === b[teamId]);
};

export const usePrototypeMatchStore = createAirJamStore<PrototypeMatchState>(
  (set) => ({
    matchPhase: "lobby",
    pointsToWin: 3,
    botCounts: createEmptyTeamCounts(),
    teamAssignments: {},
    matchSummary: null,
    matchStartedAtMs: null,

    actions: {
      syncConnectedPlayers: (_ctx, { connectedPlayerIds }) =>
        set((state) => {
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
            teamAssignments: completedAssignments,
            botCounts: normalizedBotCounts,
          };
        }),

      joinTeam: ({ actorId, connectedPlayerIds }, { teamId }) =>
        set((state) => {
          if (state.matchPhase !== "lobby") {
            return state;
          }

          if (!actorId) {
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
            return { teamAssignments: prunedAssignments };
          }

          if (currentAssignment) {
            delete nextAssignments[actorId];
          }

          const humanCountsWithoutActor = getHumanCounts(nextAssignments);
          if (isTeamFull(humanCountsWithoutActor, state.botCounts, teamId)) {
            if (prunedAssignments === state.teamAssignments) {
              return state;
            }
            return { teamAssignments: prunedAssignments };
          }

          nextAssignments[actorId] = { teamId };

          return {
            teamAssignments: nextAssignments,
          };
        }),

      setTeamBotCount: ({ connectedPlayerIds }, { teamId, count }) =>
        set((state) => {
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

          const maxBotsForTeam = Math.max(0, MAX_TEAM_SIZE - humanCounts[teamId]);
          const clampedRequested = Math.max(0, Math.min(maxBotsForTeam, Math.round(count)));

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
            teamAssignments: completedAssignments,
            botCounts: normalizedBotCounts,
          };
        }),

      setPointsToWin: (_ctx, { pointsToWin }) =>
        set((state) => {
          if (state.matchPhase !== "lobby") {
            return state;
          }

          const clamped = Math.max(1, Math.min(10, Math.round(pointsToWin)));
          if (clamped === state.pointsToWin) {
            return state;
          }

          return {
            pointsToWin: clamped,
          };
        }),

      startMatch: ({ connectedPlayerIds }) =>
        set((state) => {
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
              teamAssignments: completedAssignments,
              botCounts: normalizedBotCounts,
            };
          }

          return {
            matchPhase: "playing",
            teamAssignments: completedAssignments,
            botCounts: normalizedBotCounts,
            matchSummary: null,
            matchStartedAtMs: Date.now(),
          };
        }),

      restartMatch: () =>
        set((state) => {
          if (state.matchPhase !== "ended") {
            return state;
          }

          return {
            matchPhase: "playing",
            matchSummary: null,
            matchStartedAtMs: Date.now(),
          };
        }),

      returnToLobby: () =>
        set(() => ({
          matchPhase: "lobby",
          matchSummary: null,
          matchStartedAtMs: null,
        })),

      endMatch: (_ctx, { winner, finalScores }) =>
        set((state) => {
          if (state.matchPhase !== "playing") {
            return state;
          }

          const durationMs = state.matchStartedAtMs
            ? Math.max(0, Date.now() - state.matchStartedAtMs)
            : 0;

          return {
            matchPhase: "ended",
            matchStartedAtMs: null,
            matchSummary: {
              winner,
              finalScores,
              pointsToWin: state.pointsToWin,
              durationMs,
            },
          };
        }),
    },
  }),
);
