import { describe, expect, it } from "vitest";
import {
  createInitialMinimalState,
  reduceReset,
  reduceTap,
} from "../src/game/store";

describe("minimal store reducers", () => {
  it("starts with zeroed counters", () => {
    const initial = createInitialMinimalState();
    expect(initial.totalCount).toBe(0);
    expect(initial.perPlayerCounts).toEqual({});
  });

  it("increments total + per-player counts when a controller taps", () => {
    const state = createInitialMinimalState();
    const afterAlice = reduceTap(state, "alice");
    expect(afterAlice.totalCount).toBe(1);
    expect(afterAlice.perPlayerCounts).toEqual({ alice: 1 });

    const afterBob = reduceTap(afterAlice, "bob");
    expect(afterBob.totalCount).toBe(2);
    expect(afterBob.perPlayerCounts).toEqual({ alice: 1, bob: 1 });

    const afterAliceAgain = reduceTap(afterBob, "alice");
    expect(afterAliceAgain.totalCount).toBe(3);
    expect(afterAliceAgain.perPlayerCounts).toEqual({ alice: 2, bob: 1 });
  });

  it("ignores taps with no actor (SDK should always attach one)", () => {
    const state = createInitialMinimalState();
    const next = reduceTap(state, undefined);
    expect(next).toBe(state);
  });

  it("reset returns the initial state", () => {
    expect(reduceReset()).toEqual(createInitialMinimalState());
  });
});
