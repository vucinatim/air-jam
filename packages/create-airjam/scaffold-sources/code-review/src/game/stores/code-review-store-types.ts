import type { AirJamActionContext } from "@air-jam/sdk";
import type { Team, TeamAssignment } from "../domain/team-assignments";

export interface CodeReviewGameState {
  scores: { team1: number; team2: number };
  teamAssignments: Record<string, TeamAssignment>;
  actions: {
    syncConnectedPlayers: (
      ctx: AirJamActionContext,
      payload: { connectedPlayerIds: string[] },
    ) => void;
    joinTeam: (
      ctx: AirJamActionContext,
      payload: { team: Team },
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
