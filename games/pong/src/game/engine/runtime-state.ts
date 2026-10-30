import { FIELD_HEIGHT, FIELD_WIDTH, PADDLE_HEIGHT } from "./constants";
import type { RuntimeState } from "./types";

export const createRuntimeState = (ballSpeed: number): RuntimeState => ({
  paddle1FrontY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  paddle1BackY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  paddle2FrontY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  paddle2BackY: FIELD_HEIGHT / 2 - PADDLE_HEIGHT / 2,
  ballX: FIELD_WIDTH / 2,
  ballY: FIELD_HEIGHT / 2,
  ballVX: ballSpeed,
  ballVY: ballSpeed,
  lastTouchedTeam: null,
  awaitingServe: false,
});

export const resetBall = (
  state: RuntimeState,
  random: () => number,
  ballSpeed: number,
): void => {
  state.ballX = FIELD_WIDTH / 2;
  state.ballY = FIELD_HEIGHT / 2;
  state.ballVX = ballSpeed * (random() > 0.5 ? 1 : -1);
  state.ballVY = ballSpeed * (random() > 0.5 ? 1 : -1);
  state.lastTouchedTeam = null;
  state.awaitingServe = false;
};

export const copyRuntimeState = (
  target: RuntimeState,
  source: RuntimeState,
): void => {
  Object.assign(target, source);
};

export interface RuntimeStateBuffers {
  current: RuntimeState;
  previous: RuntimeState;
  render: RuntimeState;
}

export const createRuntimeStateBuffers = (
  ballSpeed: number,
): RuntimeStateBuffers => {
  const current = createRuntimeState(ballSpeed);
  return {
    current,
    previous: { ...current },
    render: { ...current },
  };
};

export const resetRuntimeStateBuffers = (
  buffers: RuntimeStateBuffers,
  nextState: RuntimeState,
): void => {
  copyRuntimeState(buffers.current, nextState);
  copyRuntimeState(buffers.previous, nextState);
  copyRuntimeState(buffers.render, nextState);
};

export const resetRuntimeStateBufferBall = (
  buffers: RuntimeStateBuffers,
  random: () => number,
  ballSpeed: number,
): void => {
  resetBall(buffers.current, random, ballSpeed);
  copyRuntimeState(buffers.previous, buffers.current);
  copyRuntimeState(buffers.render, buffers.current);
};

export const captureRuntimeStateStep = (buffers: RuntimeStateBuffers): void => {
  copyRuntimeState(buffers.previous, buffers.current);
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
  target.awaitingServe = current.awaitingServe;
};

export const updateRuntimeRenderState = (
  buffers: RuntimeStateBuffers,
  alpha: number,
): RuntimeState => {
  interpolateRuntimeState({
    target: buffers.render,
    previous: buffers.previous,
    current: buffers.current,
    alpha,
  });

  return buffers.render;
};
