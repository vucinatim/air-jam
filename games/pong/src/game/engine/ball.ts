import type { TeamId } from "../domain/team";
import {
  BALL_SIZE,
  FIELD_HEIGHT,
  FIELD_WIDTH,
} from "./constants";
import type { RuntimeState } from "./types";

export const advanceBall = (
  state: RuntimeState,
  countdown: number | null,
): void => {
  if (countdown !== null) {
    return;
  }

  state.ballX += state.ballVX;
  state.ballY += state.ballVY;
};

export const reflectBallOffWalls = (state: RuntimeState): void => {
  if (state.ballY <= 0 || state.ballY >= FIELD_HEIGHT - BALL_SIZE) {
    state.ballVY *= -1;
  }
};

export const applyPaddleBounce = (
  state: RuntimeState,
  team: TeamId,
): void => {
  state.ballVX = team === "team1" ? Math.abs(state.ballVX) : -Math.abs(state.ballVX);
  state.lastTouchedTeam = team;
};

export const getScoringTeam = (
  state: RuntimeState,
  countdown: number | null,
): TeamId | null => {
  if (countdown !== null) {
    return null;
  }

  if (state.ballX <= 0) {
    return "team2";
  }

  if (state.ballX >= FIELD_WIDTH - BALL_SIZE) {
    return "team1";
  }

  return null;
};
