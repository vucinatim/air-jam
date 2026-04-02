import { createAirJamStore, type AirJamActionContext } from "@air-jam/sdk";
import type { TeamCounts } from "../../domain/match-readiness";
import type { TeamId } from "../../domain/team";
import {
  createInitialMatchState,
  reduceEndMatch,
  reduceFinishCountdown,
  reduceJoinTeam,
  reduceRestartMatch,
  reduceReturnToLobby,
  reduceSetBotCount,
  reduceSetPointsToWin,
  reduceStartMatch,
  reduceSyncConnectedPlayers,
} from "./match-store-state";
import type {
  MatchPhase,
  MatchSummary,
  MatchStateSnapshot,
  TeamAssignment,
} from "./match-store-types";

interface PrototypeMatchState {
  matchPhase: MatchPhase;
  pointsToWin: number;
  botCounts: TeamCounts;
  teamAssignments: Record<string, TeamAssignment>;
  matchSummary: MatchSummary | null;
  countdownEndsAtMs: number | null;
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
    finishCountdown: (_ctx: AirJamActionContext, _payload: undefined) => void;
    restartMatch: (_ctx: AirJamActionContext, _payload: undefined) => void;
    returnToLobby: (_ctx: AirJamActionContext, _payload: undefined) => void;
    endMatch: (
      _ctx: AirJamActionContext,
      payload: { winner: TeamId; finalScores: Record<TeamId, number> },
    ) => void;
  };
}

export const usePrototypeMatchStore = createAirJamStore<PrototypeMatchState>(
  (set) => ({
    ...createInitialMatchState(),

    actions: {
      syncConnectedPlayers: (_ctx, { connectedPlayerIds }) =>
        set((state) =>
          reduceSyncConnectedPlayers(state as MatchStateSnapshot, {
            connectedPlayerIds,
          }),
        ),

      joinTeam: ({ actorId, connectedPlayerIds }, { teamId }) =>
        set((state) =>
          reduceJoinTeam(
            state as MatchStateSnapshot,
            { actorId, connectedPlayerIds },
            { teamId },
          ),
        ),

      setTeamBotCount: ({ connectedPlayerIds, role }, { teamId, count }) =>
        set((state) =>
          reduceSetBotCount(
            state as MatchStateSnapshot,
            { connectedPlayerIds, role },
            { teamId, count },
          ),
        ),

      setPointsToWin: (_ctx, { pointsToWin }) =>
        set((state) =>
          reduceSetPointsToWin(state as MatchStateSnapshot, { pointsToWin }),
        ),

      startMatch: ({ connectedPlayerIds }) =>
        set((state) =>
          reduceStartMatch(state as MatchStateSnapshot, { connectedPlayerIds }),
        ),

      finishCountdown: () =>
        set((state) => reduceFinishCountdown(state as MatchStateSnapshot)),

      restartMatch: () =>
        set((state) => reduceRestartMatch(state as MatchStateSnapshot)),

      returnToLobby: () =>
        set((state) => reduceReturnToLobby(state as MatchStateSnapshot)),

      endMatch: (_ctx, { winner, finalScores }) =>
        set((state) =>
          reduceEndMatch(state as MatchStateSnapshot, { winner, finalScores }),
        ),
    },
  }),
);

export type { MatchPhase, MatchSummary, TeamAssignment };
