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

export const copyRuntimeState = (
  target: RuntimeState,
  source: RuntimeState,
): void => {
  Object.assign(target, source);
};

const lerp = (from: number, to: number, alpha: number): number =>
  from + (to - from) * alpha;

export const interpolateRuntimeState = ({
  target,
  previous,
  current,
  alpha,
}: {
  target: RuntimeState;
  previous: RuntimeState;
  current: RuntimeState;
  alpha: number;
}): void => {
  target.paddle1FrontY = lerp(
    previous.paddle1FrontY,
    current.paddle1FrontY,
    alpha,
  );
  target.paddle1BackY = lerp(
    previous.paddle1BackY,
    current.paddle1BackY,
    alpha,
  );
  target.paddle2FrontY = lerp(
    previous.paddle2FrontY,
    current.paddle2FrontY,
    alpha,
  );
  target.paddle2BackY = lerp(
    previous.paddle2BackY,
    current.paddle2BackY,
    alpha,
  );
  target.ballX = lerp(previous.ballX, current.ballX, alpha);
  target.ballY = lerp(previous.ballY, current.ballY, alpha);
  target.ballVX = current.ballVX;
  target.ballVY = current.ballVY;
  target.lastTouchedTeam = current.lastTouchedTeam;
};
