import { describe, expect, it } from "vitest";
import {
  bridgeAction,
  defineVisualHarnessBridge,
  describeVisualHarnessActions,
} from "../src/core/bridge-contract";

describe("bridgeAction", () => {
  it("accepts finite numbers and numeric strings", () => {
    const action = bridgeAction.number<Record<string, never>, number>(
      (_context, value) => value,
    );

    expect(
      action.parse("7", { gameId: "pong", actionName: "setPointsToWin" }),
    ).toBe(7);
    expect(
      action.parse(3, { gameId: "pong", actionName: "setPointsToWin" }),
    ).toBe(3);
  });

  it("rejects invalid number payloads with a useful error", () => {
    const action = bridgeAction.number<Record<string, never>, number>(
      (_context, value) => value,
    );

    expect(() =>
      action.parse("nope", {
        gameId: "pong",
        actionName: "setPointsToWin",
      }),
    ).toThrow("[harness:pong.setPointsToWin] expected a finite number payload");
  });

  it("accepts declared enum literals and rejects unknown values", () => {
    const action = bridgeAction.enum(
      ["team1", "team2"] as const,
      (_context: Record<string, never>, value) => value,
    );

    expect(
      action.parse("team1", { gameId: "pong", actionName: "scorePoint" }),
    ).toBe("team1");
    expect(() =>
      action.parse("team3", { gameId: "pong", actionName: "scorePoint" }),
    ).toThrow("[harness:pong.scorePoint] expected one of: team1, team2");
  });

  it("describes action metadata for agents and tooling", () => {
    const actions = describeVisualHarnessActions({
      setPointsToWin: bridgeAction.number(
        {
          description: "Set the match win condition.",
          payloadDescription: "Numeric points-to-win target.",
        },
        (_context: Record<string, never>, value) => value,
      ),
      forceGameOver: bridgeAction.custom(
        {
          description: "Finish the current match immediately.",
        },
        (_context: Record<string, never>) => undefined,
      ),
    });

    expect(actions).toEqual([
      {
        name: "forceGameOver",
        description: "Finish the current match immediately.",
        payload: {
          kind: "none",
          description: null,
        },
        resultDescription: null,
      },
      {
        name: "setPointsToWin",
        description: "Set the match win condition.",
        payload: {
          kind: "number",
          description: "Numeric points-to-win target.",
        },
        resultDescription: null,
      },
    ]);
  });
});

describe("defineVisualHarnessBridge", () => {
  it("preserves the declared bridge contract", () => {
    const bridge = defineVisualHarnessBridge({
      gameId: "pong",
      selectSnapshot: (_context: Record<string, never>) => ({
        roomId: "room-1",
        controllerJoinUrl: null,
        matchPhase: "lobby",
        runtimeState: "paused",
      }),
      actions: {
        scorePoint: bridgeAction.enum(
          ["team1", "team2"] as const,
          (_context: Record<string, never>, team) => team,
        ),
      },
    });

    expect(bridge.gameId).toBe("pong");
    expect(bridge.selectSnapshot({})).toMatchObject({
      roomId: "room-1",
      matchPhase: "lobby",
    });
  });
});
