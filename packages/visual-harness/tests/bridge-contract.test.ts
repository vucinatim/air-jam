import { describe, expect, it } from "vitest";
import {
  bridgeAction,
  defineVisualHarnessBridge,
} from "../src/bridge-contract";

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
    ).toThrow(
      "[visual-harness:pong.setPointsToWin] expected a finite number payload",
    );
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
    ).toThrow("[visual-harness:pong.scorePoint] expected one of: team1, team2");
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
