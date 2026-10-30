import { createAirJamStore, type AirJamActionContext } from "@air-jam/sdk/core";
import type { AirCaptureSettings } from "../../contracts/settings";
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
  reduceSetCountdownSeconds,
  reduceSetPointsToWin,
  reduceStartMatch,
  reduceSyncConnectedPlayers,
} from "./match-store-state";
import type {
  MatchPhase,
  MatchStateSnapshot,
  MatchSummary,
  TeamAssignment,
} from "./match-store-types";

interface PrototypeMatchState {
  matchPhase: MatchPhase;
  pointsToWin: number;
  botCounts: TeamCounts;
  teamAssignments: Record<string, TeamAssignment>;
  matchSummary: MatchSummary | null;
  countdownSeconds: number | null;
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
    startMatch: (
      _ctx: AirJamActionContext<AirCaptureSettings>,
      _payload: undefined,
    ) => void;
    setCountdownSeconds: (
      ctx: AirJamActionContext,
      payload: { seconds: number },
    ) => void;
    finishCountdown: (ctx: AirJamActionContext, _payload: undefined) => void;
    restartMatch: (
      _ctx: AirJamActionContext<AirCaptureSettings>,
      _payload: undefined,
    ) => void;
    returnToLobby: (_ctx: AirJamActionContext, _payload: undefined) => void;
    endMatch: (
      ctx: AirJamActionContext,
      payload: { winner: TeamId; finalScores: Record<TeamId, number> },
    ) => void;
  };
}

export const prototypeMatchStore = createAirJamStore<PrototypeMatchState>(
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

      startMatch: ({ connectedPlayerIds, settings }) =>
        set((state) =>
          reduceStartMatch(
            state as MatchStateSnapshot,
            { connectedPlayerIds },
            settings.matchCountdownDurationMs,
          ),
        ),

      setCountdownSeconds: ({ role }, { seconds }) =>
        set((state) =>
          role === "host"
            ? reduceSetCountdownSeconds(state as MatchStateSnapshot, seconds)
            : state,
        ),

      finishCountdown: ({ now }) =>
        set((state) => reduceFinishCountdown(state as MatchStateSnapshot, now)),

      restartMatch: ({ settings }) =>
        set((state) =>
          reduceRestartMatch(
            state as MatchStateSnapshot,
            settings.matchCountdownDurationMs,
          ),
        ),

      returnToLobby: () =>
        set((state) => reduceReturnToLobby(state as MatchStateSnapshot)),

      endMatch: ({ now }, { winner, finalScores }) =>
        set((state) =>
          reduceEndMatch(
            state as MatchStateSnapshot,
            { winner, finalScores },
            now,
          ),
        ),
    },
  }),
);

export type { MatchPhase, MatchSummary, TeamAssignment };
