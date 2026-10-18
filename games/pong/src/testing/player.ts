import {
  defineAirJamPlayerContract,
  type AirJamDecisionQuestion,
} from "@air-jam/devtools/testing";
import { z } from "zod";
import {
  FIELD_HEIGHT,
  FIELD_WIDTH,
  PADDLE_HEIGHT,
} from "../game/engine/constants";

const LINED_UP_PIXELS = 10;

const snapshotSchema = z.object({
  matchPhase: z.string(),
  myAssignment: z
    .object({
      team: z.enum(["team1", "team2"]),
      position: z.enum(["front", "back"]),
    })
    .nullable(),
  teams: z.array(
    z.object({
      id: z.enum(["team1", "team2"]),
      totalCount: z.number().int().nonnegative(),
    }),
  ),
});
const TEAM_NAMES = { team1: "orange (left)", team2: "blue (right)" } as const;
const runtimeSchema = z.object({
  simulation: z.object({
    ballX: z.number(),
    ballY: z.number(),
    ballVX: z.number(),
    ballVY: z.number(),
    paddle1FrontY: z.number(),
    paddle1BackY: z.number(),
    paddle2FrontY: z.number(),
    paddle2BackY: z.number(),
    awaitingServe: z.boolean(),
  }),
});

type Snapshot = z.infer<typeof snapshotSchema>;

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

function movePaddle(
  assignment: NonNullable<Snapshot["myAssignment"]>,
  ball: z.infer<typeof runtimeSchema>["simulation"],
): AirJamDecisionQuestion {
  const left = assignment.team === "team1";
  const front = assignment.position === "front";
  const paddleTop = left
    ? front
      ? ball.paddle1FrontY
      : ball.paddle1BackY
    : front
      ? ball.paddle2FrontY
      : ball.paddle2BackY;
  const centre = Math.round(paddleTop + PADDLE_HEIGHT / 2);
  const towardsMe = left ? ball.ballVX < 0 : ball.ballVX > 0;
  return {
    state: [
      `I control the ${left ? "left" : "right"} paddle. Its top edge is at y=${Math.round(paddleTop)}, so its centre is at y=${centre}.`,
      ball.awaitingServe
        ? `The ball is waiting to be served at y=${Math.round(ball.ballY)}.`
        : `The ball is at x=${Math.round(ball.ballX)}, y=${Math.round(ball.ballY)}, moving ${towardsMe ? "towards" : "away from"} my side and ${ball.ballVY < 0 ? "upwards" : "downwards"}.`,
    ],
    question: "Which way should I move my paddle right now?",
    options: {
      up: {
        when: `The ball is above my paddle's centre by more than ${LINED_UP_PIXELS} pixels.`,
        control: { kind: "input", input: { direction: -1 } },
      },
      still: {
        when: `My paddle's centre is already within ${LINED_UP_PIXELS} pixels of the ball's height.`,
        control: { kind: "input", input: { direction: 0 } },
      },
      down: {
        when: `The ball is below my paddle's centre by more than ${LINED_UP_PIXELS} pixels.`,
        control: { kind: "input", input: { direction: 1 } },
      },
    },
  };
}

/** Pong as a person would be told it, for a decision model holding a paddle. */
export const pongPlayer = defineAirJamPlayerContract({
  brief: [
    `This is Pong on a shared screen ${FIELD_WIDTH} pixels wide and ${FIELD_HEIGHT} pixels tall.`,
    "Positions are measured from the top-left corner: x grows to the right and y grows downwards, so y=0 is the top edge.",
    "Each player moves one paddle straight up or down along their own side.",
    "The ball bounces off the top and bottom edges and off paddles, and a team scores when the ball gets past the other team's paddle.",
    `Paddles are ${PADDLE_HEIGHT} pixels tall. To return the ball, keep your paddle's centre level with the ball's height; within ${LINED_UP_PIXELS} pixels counts as lined up.`,
  ].join(" "),
  turn: ({ observation }) => {
    const snapshot = snapshotSchema.parse(observation.snapshot);
    if (snapshot.matchPhase === "lobby" && !snapshot.myAssignment)
      return chooseTeam(snapshot.teams);
    if (snapshot.matchPhase !== "playing" || !snapshot.myAssignment)
      return null;
    return movePaddle(
      snapshot.myAssignment,
      runtimeSchema.parse(observation.runtime).simulation,
    );
  },
});
