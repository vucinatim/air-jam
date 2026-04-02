import {
  BALL_SPEED,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  PADDLE_HEIGHT,
} from "./constants";
import type { RuntimeState } from "./types";

export const createRuntimeState = (): RuntimeState => ({
  paddle1FrontY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  paddle1BackY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  paddle2FrontY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  paddle2BackY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  ballX: FIELD_WIDTH / 2,
  ballY: FIELD_HEIGHT / 2,
  ballVX: BALL_SPEED,
  ballVY: BALL_SPEED,
  lastTouchedTeam: null,
});

export const resetBall = (state: RuntimeState): void => {
  state.ballX = FIELD_WIDTH / 2;
  state.ballY = FIELD_HEIGHT / 2;
  state.ballVX = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
  state.ballVY = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
  state.lastTouchedTeam = null;
};
