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
import { SHOW_PONG_FIELD_BOUNDS } from "../debug/field-debug";
import { getTeamPaddleState } from "./paddles";
import { PONG_ARENA_PREFAB } from "../prefabs/arena";
import type { DrawFrameOptions } from "./types";

export const drawFrame = ({
  ctx,
  state,
  players,
  teamAssignments,
  countdown,
  botCounts,
}: DrawFrameOptions): void => {
  PONG_ARENA_PREFAB.render(ctx, PONG_ARENA_PREFAB.defaultProps, {
    showBounds: SHOW_PONG_FIELD_BOUNDS,
  });

  const paddleState = getTeamPaddleState(players, teamAssignments, botCounts);

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

  if (countdown !== null) {
    ctx.fillStyle = "#fff";
    ctx.font = "bold 120px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(countdown.toString(), FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
  }
};
