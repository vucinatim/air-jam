import type { TeamId } from "../../shared/team";
import {
  BALL_SIZE,
  BALL_SPEED,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_X,
} from "./constants";
import { collidesWithPaddle } from "./collision";
import {
  applyBotPaddleInput,
  applyHumanPaddleInput,
  getPaddleControllerId,
  getTeamPaddleState,
} from "./paddles";
import type { RuntimeState, StepGameOptions } from "./types";

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

const setBallDirectionAfterPaddleHit = (state: RuntimeState, team: TeamId) => {
  state.ballVX = team === "team1" ? Math.abs(state.ballVX) : -Math.abs(state.ballVX);
  state.lastTouchedTeam = team;
};

export const stepGame = ({
  state,
  players,
  teamAssignments,
  getInput,
  isPlaying,
  countdown,
  botTeam,
  onPaddleHit,
  onScore,
}: StepGameOptions): void => {
  if (!isPlaying) {
    return;
  }

  applyHumanPaddleInput(state, players, teamAssignments, getInput, botTeam);
  applyBotPaddleInput(state, botTeam);

  if (countdown === null) {
    state.ballX += state.ballVX;
    state.ballY += state.ballVY;
  }

  if (state.ballY <= 0 || state.ballY >= FIELD_HEIGHT - BALL_SIZE) {
    state.ballVY *= -1;
  }

  const paddleState = getTeamPaddleState(players, teamAssignments, botTeam);
  const team1FrontControllerId =
    botTeam === "team1"
      ? null
      : getPaddleControllerId(players, teamAssignments, "team1", "front");
  const team1BackControllerId =
    botTeam === "team1"
      ? null
      : getPaddleControllerId(players, teamAssignments, "team1", "back");
  const team2FrontControllerId =
    botTeam === "team2"
      ? null
      : getPaddleControllerId(players, teamAssignments, "team2", "front");
  const team2BackControllerId =
    botTeam === "team2"
      ? null
      : getPaddleControllerId(players, teamAssignments, "team2", "back");

  if (
    paddleState.team1.hasFront &&
    collidesWithPaddle(
      state.ballX,
      state.ballY,
      PADDLE_X.team1.front,
      state.paddle1FrontY,
    )
  ) {
    setBallDirectionAfterPaddleHit(state, "team1");
    onPaddleHit?.({ team: "team1", playerId: team1FrontControllerId });
  }

  if (
    paddleState.team1.hasBack &&
    collidesWithPaddle(
      state.ballX,
      state.ballY,
      PADDLE_X.team1.back,
      state.paddle1BackY,
    )
  ) {
    setBallDirectionAfterPaddleHit(state, "team1");
    onPaddleHit?.({ team: "team1", playerId: team1BackControllerId });
  }

  if (
    paddleState.team2.hasFront &&
    collidesWithPaddle(
      state.ballX,
      state.ballY,
      PADDLE_X.team2.front,
      state.paddle2FrontY,
    )
  ) {
    setBallDirectionAfterPaddleHit(state, "team2");
    onPaddleHit?.({ team: "team2", playerId: team2FrontControllerId });
  }

  if (
    paddleState.team2.hasBack &&
    collidesWithPaddle(
      state.ballX,
      state.ballY,
      PADDLE_X.team2.back,
      state.paddle2BackY,
    )
  ) {
    setBallDirectionAfterPaddleHit(state, "team2");
    onPaddleHit?.({ team: "team2", playerId: team2BackControllerId });
  }

  if (countdown === null) {
    if (state.ballX <= 0) {
      onScore("team2");
    }
    if (state.ballX >= FIELD_WIDTH - BALL_SIZE) {
      onScore("team1");
    }
  }
};
