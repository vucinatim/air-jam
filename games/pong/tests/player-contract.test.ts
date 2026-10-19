import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { describe, expect, it } from "vitest";
import { pongPlayer } from "../src/testing/player";

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
    ]);
    expect(turn?.options.up?.control).toEqual({
      kind: "input",
      input: { direction: -1 },
    });
    expect(Object.keys(turn?.options ?? {})).toEqual(["up", "still", "down"]);
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
