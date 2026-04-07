import type { AirJamActionContext } from "@air-jam/sdk";
import type { Team, TeamAssignment } from "../domain/team-assignments";

export type CodeReviewMatchPhase = "lobby" | "playing" | "ended";

export interface CodeReviewMatchSummary {
  winner: Team | "draw";
  scores: {
    team1: number;
    team2: number;
  };
}

export interface BotCounts {
  team1: number;
  team2: number;
}

export interface CodeReviewGameState {
  matchPhase: CodeReviewMatchPhase;
  matchSummary: CodeReviewMatchSummary | null;
  scores: { team1: number; team2: number };
  teamAssignments: Record<string, TeamAssignment>;
  readyByPlayerId: Record<string, boolean>;
  botCounts: BotCounts;
  actions: {
    startMatch: (
      ctx: AirJamActionContext,
      _payload: undefined,
    ) => void;
    resetToLobby: (
      ctx: AirJamActionContext,
      _payload: undefined,
    ) => void;
    finishMatch: (
      ctx: AirJamActionContext,
      _payload: undefined,
    ) => void;
    syncConnectedPlayers: (
      ctx: AirJamActionContext,
      payload: { connectedPlayerIds: string[] },
    ) => void;
    joinTeam: (
      ctx: AirJamActionContext,
      payload: { team: Team },
    ) => void;
    setReady: (
      ctx: AirJamActionContext,
      payload: { ready: boolean },
    ) => void;
    setBotCount: (
      ctx: AirJamActionContext,
      payload: { team: Team; count: number },
    ) => void;
    resetGame: (
      ctx: AirJamActionContext,
      _payload: undefined,
    ) => void;
    scorePoint: (
      ctx: AirJamActionContext,
      payload: { team: Team },
    ) => void;
  };
}
