import { describe, expect, it } from "vitest";
import { isRpcSerializable } from "../src/utils/is-rpc-serializable";

describe("RPC JSON serialization", () => {
  it("accepts the shared score object used by a completed match", () => {
    const scores = { team1: 5, team2: 3 };
    const state = { scores, matchSummary: { finalScores: scores } };
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    expect(isRpcSerializable(state)).toBe(true);
  });
  it("rejects real cycles, including cycles beneath a shared reference", () => {
    const object: Record<string, unknown> = {};
    object.self = object;
    expect(isRpcSerializable(object)).toBe(false);
    const left: Record<string, unknown> = {},
      right = { left };
    left.right = right;
    expect(isRpcSerializable([left, right])).toBe(false);
  });
  it("rejects non-JSON payload values", () => {
    for (const value of [
      Infinity,
      NaN,
      1n,
      Symbol("x"),
      () => 0,
      { nested: () => 0 },
    ])
      expect(isRpcSerializable(value)).toBe(false);
  });
});
