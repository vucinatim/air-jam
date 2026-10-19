import { airJamDecisionQuestionSchema } from "@air-jam/devtools/testing";
import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { describe, expect, it } from "vitest";
import { BALL_SIZE, FIELD_HEIGHT } from "../src/game/engine/constants";
import { simulationOf } from "../src/testing/observation";
import { ballArrival, pongPlayer } from "../src/testing/player";

const observe = (
  snapshot: Record<string, unknown>,
  simulation: Record<string, unknown>,
) =>
  ({
    snapshot,
    runtime: {
      simulation: {
        ballX: 400,
        ballY: 120,
        ballVX: -360,
        ballVY: 90,
        paddle1FrontY: 200,
        paddle1BackY: 200,
        paddle2FrontY: 150,
        paddle2BackY: 150,
        awaitingServe: false,
        ...simulation,
      },
    },
  }) as unknown as HostObservation;
const teams = [
  {
    id: "team1",
    botCount: 0,
    totalCount: 1,
    players: [{ playerId: "human", position: "front" }],
  },
  { id: "team2", botCount: 0, totalCount: 0, players: [] },
];
const scores = { team1: 0, team2: 0 };
const playing = {
  matchPhase: "playing",
  scores,
  myAssignment: { team: "team1", position: "front" },
  teams,
};

describe("Pong player contract", () => {
  it("describes the left paddle and an approaching ball in plain positions", () => {
    const turn = pongPlayer.turn({
      observation: observe(playing, {}),
      seatId: "player",
    });
    expect(turn?.state).toEqual([
      "I control the left paddle. Its top edge is at y=200, so its centre is at y=250.",
      "The ball is at x=400, y=120, moving towards my side and downwards.",
      "It will reach my paddle's line at about y=216 in 1.0 s.",
    ]);
    airJamDecisionQuestionSchema.parse(turn);
    expect(Object.keys(turn?.options ?? {})).toEqual([
      "meet",
      "top",
      "upper",
      "middle",
      "lower",
      "bottom",
    ]);
    // Meeting the ball at y=216 from a centre at 250 eases the paddle upwards.
    expect(turn?.options.meet?.control).toEqual({
      kind: "input",
      input: { direction: -34 / 72 },
    });
    const seat = pongPlayer.act.create();
    expect(
      seat.control({
        observation: observe(playing, {}),
        seatId: "player",
        choice: "top",
      }),
    ).toEqual({ kind: "input", input: { direction: -1 } });
    expect(
      seat.control({
        observation: observe(playing, { paddle1FrontY: 166 }),
        seatId: "player",
        choice: "meet",
      }),
    ).toEqual({ kind: "input", input: { direction: 0 } });
  });

  it("predicts where a ball bouncing off a wall will reach the paddle", () => {
    const fold = (top: number, travel: number) =>
      top <= travel ? top : 2 * travel - top;
    const travel = FIELD_HEIGHT - BALL_SIZE;
    const seconds = (30 + 15 - 400) / -360;
    const expected = Math.round(
      fold(500 + 300 * seconds, travel) + BALL_SIZE / 2,
    );
    expect(
      ballArrival(
        { team: "team1", position: "front" },
        simulationOf(observe(playing, { ballY: 500, ballVY: 300 }).runtime),
      ),
    ).toEqual({ y: expected, seconds });
    expect(expected).toBeLessThan(500);
  });

  it("reads the right paddle for team two and a ball moving away", () => {
    const turn = pongPlayer.turn({
      observation: observe(
        { ...playing, myAssignment: { team: "team2", position: "front" } },
        {},
      ),
      seatId: "player",
    });
    expect(turn?.state[0]).toContain("right paddle");
    expect(turn?.state[0]).toContain("top edge is at y=150");
    expect(turn?.state[1]).toContain("away from my side");
  });

  it("asks which team to join from the lobby, as join actions", () => {
    const turn = pongPlayer.turn({
      observation: observe(
        { matchPhase: "lobby", scores, myAssignment: null, teams },
        {},
      ),
      seatId: "player",
    });
    expect(turn?.state[0]).toContain("orange (left) team has 1 players");
    expect(turn?.options.team2?.control).toEqual({
      kind: "action",
      actionId: "join_team",
      input: "team2",
    });
  });

  it("has nothing to decide after the match or while waiting in a team", () => {
    for (const snapshot of [
      { ...playing, matchPhase: "ended" },
      { ...playing, matchPhase: "lobby" },
    ])
      expect(
        pongPlayer.turn({
          observation: observe(snapshot, {}),
          seatId: "player",
        }),
      ).toBeNull();
  });
});
