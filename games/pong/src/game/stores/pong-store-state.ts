import { createEmptyBotCounts } from "../domain/team-slots";
import type { PongState } from "./pong-store-types";

export const createInitialPongState = (): Omit<PongState, "actions"> => ({
  scores: { team1: 0, team2: 0 },
  matchPhase: "lobby",
  botCounts: createEmptyBotCounts(),
  pointsToWin: 5,
  matchSummary: null,
  matchStartedAtMs: null,
  teamAssignments: {},
});
export {
  reduceJoinTeam,
  reduceSetBotCount,
  reduceSetPointsToWin,
  reduceStartMatch,
} from "./pong-store-lobby";
export {
  reduceRestartMatch,
  reduceReturnToLobby,
  reduceScorePoint,
} from "./pong-store-match";
