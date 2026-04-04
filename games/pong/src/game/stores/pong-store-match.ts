import { type TeamId } from "../domain/team";
import type { PongState } from "./pong-store-types";

export const reduceRestartMatch = (
  state: PongState,
): Partial<PongState> | PongState => {
  if (state.matchPhase !== "ended") {
    return state;
  }

  return {
    scores: { team1: 0, team2: 0 },
    matchPhase: "playing",
    matchSummary: null,
    matchStartedAtMs: Date.now(),
  };
};

export const reduceReturnToLobby = (state: PongState): Partial<PongState> => ({
  scores: { team1: 0, team2: 0 },
  matchPhase: "lobby",
  matchSummary: null,
  matchStartedAtMs: null,
  pointsToWin: state.pointsToWin,
});

export const reduceScorePoint = (
  state: PongState,
  team: TeamId,
): Partial<PongState> | PongState => {
  if (state.matchPhase !== "playing") {
    return state;
  }

  const nextScores = {
    ...state.scores,
    [team]: state.scores[team] + 1,
  };

  if (nextScores[team] < state.pointsToWin) {
    return { scores: nextScores };
  }

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
};
