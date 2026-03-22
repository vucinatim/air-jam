import {
  BALL_SIZE,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_X,
  TEAM1_COLOR,
  TEAM2_COLOR,
} from "./constants";
import { getTeamPaddleState } from "./paddles";
import type { DrawFrameOptions } from "./types";

export const drawFrame = ({
  ctx,
  state,
  players,
  teamAssignments,
  countdown,
  botTeam,
}: DrawFrameOptions): void => {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  const paddleState = getTeamPaddleState(players, teamAssignments, botTeam);

  if (paddleState.team1.hasFront || paddleState.team1.hasBack) {
    ctx.fillStyle = TEAM1_COLOR;
    if (paddleState.team1.hasFront) {
      ctx.fillRect(
        PADDLE_X.team1.front,
        state.paddle1FrontY,
        PADDLE_WIDTH,
        PADDLE_HEIGHT,
      );
    }
    if (paddleState.team1.hasBack) {
      ctx.fillRect(
        PADDLE_X.team1.back,
        state.paddle1BackY,
        PADDLE_WIDTH,
        PADDLE_HEIGHT,
      );
    }
  }

  if (paddleState.team2.hasFront || paddleState.team2.hasBack) {
    ctx.fillStyle = TEAM2_COLOR;
    if (paddleState.team2.hasFront) {
      ctx.fillRect(
        PADDLE_X.team2.front,
        state.paddle2FrontY,
        PADDLE_WIDTH,
        PADDLE_HEIGHT,
      );
    }
    if (paddleState.team2.hasBack) {
      ctx.fillRect(
        PADDLE_X.team2.back,
        state.paddle2BackY,
        PADDLE_WIDTH,
        PADDLE_HEIGHT,
      );
    }
  }

  ctx.fillStyle =
    state.lastTouchedTeam === "team1"
      ? TEAM1_COLOR
      : state.lastTouchedTeam === "team2"
        ? TEAM2_COLOR
        : "#fff";
  ctx.beginPath();
  ctx.arc(
    state.ballX + BALL_SIZE / 2,
    state.ballY + BALL_SIZE / 2,
    BALL_SIZE / 2,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  ctx.setLineDash([5, 15]);
  ctx.beginPath();
  ctx.moveTo(FIELD_WIDTH / 2, 0);
  ctx.lineTo(FIELD_WIDTH / 2, FIELD_HEIGHT);
  ctx.strokeStyle = "#333";
  ctx.stroke();

  if (countdown !== null) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 120px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(countdown.toString(), FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
  }
};
