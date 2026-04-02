import type { AirJamActionContext } from "@air-jam/sdk";
import type { TeamId } from "../domain/team";
import type { BotCounts } from "../domain/team-slots";

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

export interface PongState {
  scores: { team1: number; team2: number };
  matchPhase: "lobby" | "playing" | "ended";
  botCounts: BotCounts;
  pointsToWin: number;
  matchSummary: MatchSummary | null;
  matchStartedAtMs: number | null;
  teamAssignments: Record<string, TeamAssignment>;

  actions: {
    joinTeam: (ctx: AirJamActionContext, payload: { team: TeamId }) => void;
    setPointsToWin: (
      _ctx: AirJamActionContext,
      payload: { pointsToWin: number },
    ) => void;
    setBotCount: (
      _ctx: AirJamActionContext,
      payload: { team: TeamId; count: number },
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
