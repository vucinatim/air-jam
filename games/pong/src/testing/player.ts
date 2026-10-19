import type {
  AirJamDecisionQuestion,
  AirJamPlayControl,
  AirJamPlayerContract,
} from "@air-jam/devtools/testing";
import type { HostObservation } from "@air-jam/sdk/runtime-control";
import {
  BALL_SIZE,
  FIELD_HEIGHT,
  FIELD_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_SPEED,
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

/** Fixed heights a seat can aim at, besides meeting the ball. */
const HEIGHTS = {
  top: 60,
  upper: Math.round(FIELD_HEIGHT * 0.3),
  middle: Math.round(FIELD_HEIGHT / 2),
  lower: Math.round(FIELD_HEIGHT * 0.7),
  bottom: FIELD_HEIGHT - 60,
};
type Aim = keyof typeof HEIGHTS | "meet";
const isAim = (choice: string): choice is Aim =>
  choice === "meet" || Object.hasOwn(HEIGHTS, choice);

/** The paddle centre's target for an aim right now. */
function aimHeight(aim: Aim, assignment: PaddleAssignment, ball: Simulation) {
  if (aim !== "meet") return HEIGHTS[aim];
  return ballArrival(assignment, ball)?.y ?? HEIGHTS.middle;
}

/** Steer the paddle smoothly towards a height, as the game's own bot does. */
function steerTo(
  target: number,
  assignment: PaddleAssignment,
  ball: Simulation,
): AirJamPlayControl {
  const centre = paddleTop(assignment, ball) + PADDLE_HEIGHT / 2;
  const gap = target - centre;
  return {
    kind: "input",
    input: {
      direction:
        Math.abs(gap) <= LINED_UP_PIXELS
          ? 0
          : Math.max(-1, Math.min(1, gap / (PADDLE_SPEED * 0.1))),
    },
  };
}

function playing(observation: HostObservation) {
  const snapshot = snapshotSchema.parse(observation.snapshot);
  if (snapshot.matchPhase !== "playing" || !snapshot.myAssignment) return null;
  return {
    assignment: snapshot.myAssignment,
    ball: simulationOf(observation.runtime),
  };
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
  const options: AirJamDecisionQuestion["options"] = {};
  if (arrival)
    options.meet = {
      when: `I am aiming to meet the ball where it will reach my paddle, at about y=${arrival.y}.`,
      control: steerTo(arrival.y, assignment, ball),
    };
  for (const [aim, height] of Object.entries(HEIGHTS))
    options[aim] = {
      when: `The height I am aiming for is about y=${height}.`,
      control: steerTo(height, assignment, ball),
    };
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
    question: "What should my paddle aim for now?",
    options,
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
    "My paddle moves itself towards whatever height I aim for; I choose the aim.",
    `Unless you have been given another goal, aim to meet the ball where it will reach your paddle, and while it moves away, aim at the middle (y=${FIELD_HEIGHT / 2}).`,
  ].join(" "),
  turn: ({ observation }) => {
    const snapshot = snapshotSchema.parse(observation.snapshot);
    if (snapshot.matchPhase === "lobby" && !snapshot.myAssignment)
      return chooseTeam(snapshot.teams);
    if (snapshot.matchPhase !== "playing" || !snapshot.myAssignment)
      return null;
    return movePaddle(snapshot.myAssignment, simulationOf(observation.runtime));
  },
  act: {
    // A paddle needs corrections every step; the model rethinks its aim
    // about once a second, or as soon as meeting the ball stops applying.
    rethinkMs: 1000,
    create: () => ({
      control: ({ observation, choice }) => {
        const current = playing(observation);
        if (!current || !isAim(choice)) return null;
        return steerTo(
          aimHeight(choice, current.assignment, current.ball),
          current.assignment,
          current.ball,
        );
      },
    }),
  },
} satisfies AirJamPlayerContract;
