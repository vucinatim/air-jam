import {
  createAirJamStore,
  type AirJamActionContext,
} from "@air-jam/sdk";
import {
  getMatchReadiness,
  getTeamCounts,
} from "./shared/match-readiness";
import {
  oppositeTeam,
  type TeamId,
} from "./shared/team";

export interface TeamAssignment {
  team: TeamId;
  position: "front" | "back";
}

export interface MatchSummary {
  winner: TeamId;
  finalScores: { team1: number; team2: number };
  durationMs: number;
  pointsToWin: number;
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

export interface PongState {
  scores: { team1: number; team2: number };
  matchPhase: "lobby" | "playing" | "ended";
  botTeam: TeamId | null;
  pointsToWin: number;
  matchSummary: MatchSummary | null;
  matchStartedAtMs: number | null;
  // Map controllerId -> { team, position }
  teamAssignments: Record<string, TeamAssignment>;

  actions: {
    joinTeam: (ctx: AirJamActionContext, payload: { team: TeamId }) => void;
    setPointsToWin: (
      _ctx: AirJamActionContext,
      payload: { pointsToWin: number },
    ) => void;
    setBotEnabled: (
      _ctx: AirJamActionContext,
      payload: { enabled: boolean },
    ) => void;
    startMatch: (_ctx: AirJamActionContext, _payload: undefined) => void;
    restartMatch: (_ctx: AirJamActionContext, _payload: undefined) => void;
    returnToLobby: (_ctx: AirJamActionContext, _payload: undefined) => void;
    scorePoint: (
      _ctx: AirJamActionContext,
      payload: { team: TeamId },
    ) => void;
  };
}

// This store is automatically synced between the host and all controllers.
export const usePongStore = createAirJamStore<PongState>((set) => ({
  scores: { team1: 0, team2: 0 },
  matchPhase: "lobby",
  botTeam: null,
  pointsToWin: 5,
  matchSummary: null,
  matchStartedAtMs: null,
  teamAssignments: {},

  actions: {
    joinTeam: ({ actorId, connectedPlayerIds }, { team }) => {
      const playerId = actorId;
      if (!playerId) return;

      set((state) => {
        if (state.matchPhase !== "lobby") {
          return state;
        }

        if (state.botTeam === team) {
          return state;
        }

        const connectedSet = toConnectedPlayerIdSet(connectedPlayerIds, playerId);
        const prunedAssignments = pruneDisconnectedAssignments(
          state.teamAssignments,
          connectedSet,
        );
        const newAssignments = { ...prunedAssignments };
        const currentAssignment = newAssignments[playerId];

        // If player is already on this team, don't change anything
        if (currentAssignment && currentAssignment.team === team) {
          if (prunedAssignments === state.teamAssignments) {
            return state;
          }
          return { teamAssignments: prunedAssignments };
        }

        // Remove player from their current team if they're switching
        if (currentAssignment && currentAssignment.team !== team) {
          delete newAssignments[playerId];
        }

        // Count players in the target team (excluding the current player)
        const teamPlayers = Object.entries(newAssignments).filter(
          ([, assignment]) => assignment.team === team,
        );

        // Enforce max 2 players per team
        if (teamPlayers.length >= 2) {
          // Team is full, don't allow assignment
          if (prunedAssignments === state.teamAssignments) {
            return state;
          }
          return { teamAssignments: prunedAssignments };
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

    setPointsToWin: (_ctx, { pointsToWin }) =>
      set((state) => {
        if (state.matchPhase !== "lobby") {
          return state;
        }

        const clamped = Math.max(1, Math.min(21, Math.round(pointsToWin)));
        if (state.pointsToWin === clamped) {
          return state;
        }

        return { pointsToWin: clamped };
      }),

    setBotEnabled: ({ actorId, connectedPlayerIds }, { enabled }) =>
      set((state) => {
        if (state.matchPhase !== "lobby") {
          return state;
        }

        const connectedSet = toConnectedPlayerIdSet(connectedPlayerIds);
        const teamAssignments = pruneDisconnectedAssignments(
          state.teamAssignments,
          connectedSet,
        );

        if (!enabled) {
          if (state.botTeam === null && teamAssignments === state.teamAssignments) {
            return state;
          }
          return { botTeam: null, teamAssignments };
        }

        const actorTeam = actorId ? teamAssignments[actorId]?.team : undefined;
        const assignments = Object.values(teamAssignments);
        const teamCounts = getTeamCounts(assignments);

        const nextBotTeam =
          actorTeam !== undefined
            ? oppositeTeam(actorTeam)
            : teamCounts.team1 > 0 && teamCounts.team2 === 0
              ? "team2"
              : teamCounts.team2 > 0 && teamCounts.team1 === 0
                ? "team1"
                : teamCounts.team1 === 0 && teamCounts.team2 === 0
                  ? "team2"
                  : null;

        if (!nextBotTeam) {
          if (teamAssignments === state.teamAssignments) {
            return state;
          }
          return { teamAssignments };
        }

        const targetTeamHasHuman = assignments.some(
          (assignment) => assignment.team === nextBotTeam,
        );
        if (targetTeamHasHuman) {
          if (teamAssignments === state.teamAssignments) {
            return state;
          }
          return { teamAssignments };
        }

        if (state.botTeam === nextBotTeam && teamAssignments === state.teamAssignments) {
          return state;
        }

        return {
          botTeam: nextBotTeam,
          teamAssignments,
        };
      }),

    startMatch: ({ connectedPlayerIds }) =>
      set((state) => {
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
        const { canStart: hasEnoughPlayers } = getMatchReadiness(
          teamCounts,
          state.botTeam,
        );

        if (!hasEnoughPlayers) {
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
      }),

    restartMatch: () =>
      set((state) => {
        if (state.matchPhase !== "ended") {
          return state;
        }

        return {
          scores: { team1: 0, team2: 0 },
          matchPhase: "playing",
          matchSummary: null,
          matchStartedAtMs: Date.now(),
        };
      }),

    returnToLobby: () =>
      set((state) => ({
        scores: { team1: 0, team2: 0 },
        matchPhase: "lobby",
        matchSummary: null,
        matchStartedAtMs: null,
        pointsToWin: state.pointsToWin,
      })),

    scorePoint: (_ctx, { team }) =>
      set((state) => {
        if (state.matchPhase !== "playing") {
          return state;
        }

        const nextScores = {
          ...state.scores,
          [team]: state.scores[team] + 1,
        };
        const didWin = nextScores[team] >= state.pointsToWin;
        if (didWin) {
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
        }

        return {
          scores: nextScores,
        };
      }),
  },
}));
