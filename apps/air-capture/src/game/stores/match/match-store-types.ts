import type { TeamCounts } from "../../domain/match-readiness";
import type { TeamId } from "../../domain/team";

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

export interface MatchStateSnapshot {
  matchPhase: MatchPhase;
  pointsToWin: number;
  botCounts: TeamCounts;
  teamAssignments: Record<string, TeamAssignment>;
  matchSummary: MatchSummary | null;
  matchStartedAtMs: number | null;
}

export interface MatchActionContext {
  actorId?: string;
  connectedPlayerIds?: string[];
  role?: "host" | "controller";
}
