import {
  PADDLE_X,
} from "./constants";
import {
  advanceBall,
  applyPaddleBounce,
  getScoringTeam,
  reflectBallOffWalls,
} from "./ball";
import { collidesWithPaddle } from "./collision";
import {
  applyBotPaddleInput,
  applyHumanPaddleInput,
  getPaddleControllerId,
  getTeamPaddleState,
} from "./paddles";
import type { StepGameOptions } from "./types";

export const stepGame = ({
  state,
  players,
  teamAssignments,
  getInput,
  isPlaying,
  countdown,
  botCounts,
  onPaddleHit,
  onScore,
}: StepGameOptions): void => {
  if (!isPlaying) {
    return;
  }

  applyHumanPaddleInput(state, players, teamAssignments, getInput);
  applyBotPaddleInput(state, teamAssignments, botCounts);
  advanceBall(state, countdown);
  reflectBallOffWalls(state);

  const paddleState = getTeamPaddleState(players, teamAssignments, botCounts);
  const team1FrontControllerId = getPaddleControllerId(
    players,
    teamAssignments,
    "team1",
    "front",
  );
  const team1BackControllerId = getPaddleControllerId(
    players,
    teamAssignments,
    "team1",
    "back",
  );
  const team2FrontControllerId = getPaddleControllerId(
    players,
    teamAssignments,
    "team2",
    "front",
  );
  const team2BackControllerId = getPaddleControllerId(
    players,
    teamAssignments,
    "team2",
    "back",
  );

  if (
    paddleState.team1.hasFront &&
    collidesWithPaddle(
      state.ballX,
      state.ballY,
      PADDLE_X.team1.front,
      state.paddle1FrontY,
    )
  ) {
    applyPaddleBounce(state, "team1");
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
    applyPaddleBounce(state, "team1");
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
    applyPaddleBounce(state, "team2");
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
    applyPaddleBounce(state, "team2");
    onPaddleHit?.({ team: "team2", playerId: team2BackControllerId });
  }

  const scoringTeam = getScoringTeam(state, countdown);
  if (scoringTeam) {
    onScore(scoringTeam);
  }
};
