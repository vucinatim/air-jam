import { BALL_SIZE, PADDLE_HEIGHT, PADDLE_WIDTH } from "./constants";

const rectsOverlap = (
  aMin: number,
  aMax: number,
  bMin: number,
  bMax: number,
): boolean => aMax >= bMin && aMin <= bMax;

export const collidesWithPaddle = (
  ballX: number,
  ballY: number,
  paddleX: number,
  paddleY: number,
): boolean =>
  rectsOverlap(ballX, ballX + BALL_SIZE, paddleX, paddleX + PADDLE_WIDTH) &&
  rectsOverlap(ballY, ballY + BALL_SIZE, paddleY, paddleY + PADDLE_HEIGHT);
