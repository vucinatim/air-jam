import { type TeamId } from "../domain/team";
import type { PongState } from "./pong-store-types";

export const reduceRestartMatch = (
  state: PongState,
  nowMs: number,
): Partial<PongState> | PongState => {
  if (state.matchPhase !== "ended") {
    return state;
  }

  return {
    scores: { team1: 0, team2: 0 },
    matchPhase: "playing",
    matchSummary: null,
    matchStartedAtMs: nowMs,
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
  nowMs: number,
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

  const durationMs =
    state.matchStartedAtMs === null
      ? 0
      : Math.max(0, nowMs - state.matchStartedAtMs);

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
