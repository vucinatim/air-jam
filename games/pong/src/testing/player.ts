import type {
  AirJamDecisionQuestion,
  AirJamPlayerContract,
} from "@air-jam/devtools/testing";
import {
  BALL_SIZE,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_X,
} from "../game/engine/constants";
import {
  paddleTop,
  simulationOf,
  snapshotSchema,
  type PaddleAssignment,
  type Simulation,
  type Snapshot,
} from "./observation";

const LINED_UP_PIXELS = 10;

const TEAM_NAMES = { team1: "orange (left)", team2: "blue (right)" } as const;

function chooseTeam(teams: Snapshot["teams"]): AirJamDecisionQuestion {
  const size = (team: "team1" | "team2") =>
    teams.find((entry) => entry.id === team)?.totalCount ?? 0;
  return {
    state: [
      `We are in the lobby. The ${TEAM_NAMES.team1} team has ${size("team1")} players and the ${TEAM_NAMES.team2} team has ${size("team2")}.`,
    ],
    question: "Which team should I join so the match is balanced?",
    options: {
      team1: {
        when: `The ${TEAM_NAMES.team1} team has no more players than the ${TEAM_NAMES.team2} team.`,
        control: { kind: "action", actionId: "join_team", input: "team1" },
      },
      team2: {
        when: `The ${TEAM_NAMES.team2} team has fewer players than the ${TEAM_NAMES.team1} team.`,
        control: { kind: "action", actionId: "join_team", input: "team2" },
      },
    },
  };
}

/**
 * Where and when the ball's centre will reach this paddle's face, following its
 * straight path and its bounces off the top and bottom walls, as a player
 * reading the ball would. Null while it is served or moving away.
 */
export function ballArrival(assignment: PaddleAssignment, ball: Simulation) {
  if (ball.awaitingServe) return null;
  const left = assignment.team === "team1";
  const paddleX = PADDLE_X[assignment.team][assignment.position];
  const faceX = left ? paddleX + PADDLE_WIDTH : paddleX - BALL_SIZE;
  const seconds = (faceX - ball.ballX) / ball.ballVX;
  if (!(seconds > 0)) return null;
  const travel = FIELD_HEIGHT - BALL_SIZE;
  const unfolded =
    (((ball.ballY + ball.ballVY * seconds) % (2 * travel)) + 2 * travel) %
    (2 * travel);
  const top = unfolded <= travel ? unfolded : 2 * travel - unfolded;
  return { y: Math.round(top + BALL_SIZE / 2), seconds };
}

function movePaddle(
  assignment: PaddleAssignment,
  ball: Simulation,
): AirJamDecisionQuestion {
  const left = assignment.team === "team1";
  const top = paddleTop(assignment, ball);
  const centre = Math.round(top + PADDLE_HEIGHT / 2);
  const towardsMe = left ? ball.ballVX < 0 : ball.ballVX > 0;
  const arrival = ballArrival(assignment, ball);
  return {
    state: [
      `I control the ${left ? "left" : "right"} paddle. Its top edge is at y=${Math.round(top)}, so its centre is at y=${centre}.`,
      ball.awaitingServe
        ? `The ball is waiting to be served at y=${Math.round(ball.ballY)}.`
        : `The ball is at x=${Math.round(ball.ballX)}, y=${Math.round(ball.ballY)}, moving ${towardsMe ? "towards" : "away from"} my side and ${ball.ballVY < 0 ? "upwards" : "downwards"}.`,
      ...(arrival
        ? [
            `It will reach my paddle's line at about y=${arrival.y} in ${arrival.seconds.toFixed(1)} s.`,
          ]
        : []),
    ],
    question: "Which way should I move my paddle right now?",
    options: {
      up: {
        when: `The height I am aiming for is above my paddle's centre by more than ${LINED_UP_PIXELS} pixels.`,
        control: { kind: "input", input: { direction: -1 } },
      },
      still: {
        when: `My paddle's centre is already within ${LINED_UP_PIXELS} pixels of the height I am aiming for.`,
        control: { kind: "input", input: { direction: 0 } },
      },
      down: {
        when: `The height I am aiming for is below my paddle's centre by more than ${LINED_UP_PIXELS} pixels.`,
        control: { kind: "input", input: { direction: 1 } },
      },
    },
  };
}

/** Pong as a person would be told it, for a decision model holding a paddle. */
export const pongPlayer = {
  brief: [
    `This is Pong on a shared screen ${FIELD_WIDTH} pixels wide and ${FIELD_HEIGHT} pixels tall.`,
    "Positions are measured from the top-left corner: x grows to the right and y grows downwards, so y=0 is the top edge.",
    "Each player moves one paddle straight up or down along their own side.",
    "The ball bounces off the top and bottom edges and off paddles, and a team scores when the ball gets past the other team's paddle.",
    `Paddles are ${PADDLE_HEIGHT} pixels tall. To return the ball, have your paddle's centre level with the ball when it reaches your paddle; within ${LINED_UP_PIXELS} pixels counts as lined up.`,
    `Unless you have been given another goal, aim your paddle's centre at the height where the ball will reach your paddle, and while it moves away, at the middle (y=${FIELD_HEIGHT / 2}).`,
  ].join(" "),
  turn: ({ observation }) => {
    const snapshot = snapshotSchema.parse(observation.snapshot);
    if (snapshot.matchPhase === "lobby" && !snapshot.myAssignment)
      return chooseTeam(snapshot.teams);
    if (snapshot.matchPhase !== "playing" || !snapshot.myAssignment)
      return null;
    return movePaddle(snapshot.myAssignment, simulationOf(observation.runtime));
  },
} satisfies AirJamPlayerContract;
