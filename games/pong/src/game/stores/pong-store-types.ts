/**
 * Type surface for the networked pong store.
 *
 * State fields are replicated to every controller on every store change.
 * Action signatures use `AirJamActionContext` as their first arg — the SDK
 * injects `actorId`, `role`, and `connectedPlayerIds` at dispatch time, so
 * reducers can tell which controller initiated the action without trusting
 * client-supplied identity.
 */
import type { AirJamActionContext } from "@air-jam/sdk";
import type { TeamId } from "../domain/team";
import type { BotCounts } from "../domain/team-slots";

/** Which side + slot a player is assigned to in the lobby. */
export interface TeamAssignment {
  team: TeamId;
  position: "front" | "back";
}

/** Snapshot of a finished match, shown on the ended screen. */
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
    scorePoint: (_ctx: AirJamActionContext, payload: { team: TeamId }) => void;
  };
}
