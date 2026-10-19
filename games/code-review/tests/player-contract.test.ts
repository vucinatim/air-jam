import { airJamDecisionQuestionSchema } from "@air-jam/devtools/testing";
import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { describe, expect, it } from "vitest";
import { codeReviewPlayer } from "../src/testing/player";

const fighter = (overrides: Record<string, unknown>) => ({
  playerId: "bot",
  team: "team2",
  isBot: true,
  x: 400,
  y: 360,
  punching: false,
  defending: false,
  stunned: false,
  empowered: false,
  ...overrides,
});
const observe = (
  snapshot: Record<string, unknown>,
  fighters: Record<string, unknown>[],
  knockout = false,
) =>
  ({
    controllerId: "human",
    snapshot,
    runtime: {
      ring: { minX: 60, maxX: 660, minY: 60, maxY: 660 },
      punchReach: 90,
      hp: { team1: 84, team2: 92 },
      knockout: { active: knockout, winner: null },
      fighters,
    },
  }) as unknown as HostObservation;
const teams = [
  { id: "team1", label: "Coder", totalCount: 1 },
  { id: "team2", label: "Reviewer", totalCount: 1 },
];
const playing = {
  matchPhase: "playing",
  scores: { team1: 0, team2: 0 },
  myAssignment: { team: "team1", position: "front" },
  teams,
};
const me = fighter({
  playerId: "human",
  team: "team1",
  isBot: false,
  x: 200,
  y: 360,
});

describe("Code Review player contract", () => {
  it("describes both fighters and offers moves towards and away from the nearest opponent", () => {
    const turn = codeReviewPlayer.turn({
      observation: observe(playing, [me, fighter({ punching: true })]),
      seatId: "player",
    });
    airJamDecisionQuestionSchema.parse(turn);
    expect(turn?.state).toEqual([
      "My fighter is at x=200, y=360.",
      "The nearest opponent is at x=400, y=360, 200 pixels away, punching.",
      "My team has 84 health left and theirs has 92.",
    ]);
    expect(Object.keys(turn?.options ?? {})).toEqual([
      "approach",
      "punch",
      "guard",
      "retreat",
    ]);
    expect(turn?.options.approach?.control).toEqual({
      kind: "input",
      input: {
        horizontal: 1,
        vertical: 0,
        leftPunch: false,
        rightPunch: false,
        defend: false,
      },
    });
    expect(turn?.options.retreat?.control).toMatchObject({
      input: { horizontal: -1 },
    });
  });

  it("asks which team to join from the lobby, and nothing between rounds", () => {
    const lobby = codeReviewPlayer.turn({
      observation: observe(
        { ...playing, matchPhase: "lobby", myAssignment: null },
        [],
      ),
      seatId: "player",
    });
    expect(lobby?.options.team1?.control).toEqual({
      kind: "action",
      actionId: "join_team",
      input: "team1",
    });
    expect(
      codeReviewPlayer.turn({
        observation: observe(playing, [me, fighter({})], true),
        seatId: "player",
      }),
    ).toBeNull();
  });
});
