import type { HostObservation } from "@air-jam/sdk/runtime-control";
import { describe, expect, it } from "vitest";
import { minimalPlayer } from "../src/testing/player";

const observe = (controllerId: string | null) =>
  ({
    controllerId,
    snapshot: { perPlayerCounts: { me: 4, someone: 9 } },
  }) as unknown as HostObservation;

describe("minimal player contract", () => {
  it("reads only the seat's own count and offers tap or doing nothing", () => {
    const turn = minimalPlayer.turn({
      observation: observe("me"),
      seatId: "first",
      random: () => 0.5,
      elapsedMs: 0,
    });
    expect(turn?.state).toEqual(["My own count is 4."]);
    expect(turn?.options.tap?.control).toEqual({
      kind: "action",
      actionId: "tap",
    });
    expect(turn?.options.wait?.control).toEqual({ kind: "release" });
  });

  it("starts from zero for a seat that has not tapped yet", () => {
    expect(
      minimalPlayer.turn({
        observation: observe("new"),
        seatId: "first",
        random: () => 0.5,
        elapsedMs: 0,
      })?.state,
    ).toEqual(["My own count is 0."]);
  });
});
