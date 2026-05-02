import { describe, expect, it } from "vitest";
import { getPongHostRuntimeEffects } from "./use-pong-host-runtime-state";

describe("getPongHostRuntimeEffects", () => {
  it("starts the countdown when the match enters playing", () => {
    expect(
      getPongHostRuntimeEffects({
        previousPhase: "lobby",
        matchPhase: "playing",
        previousScores: { team1: 0, team2: 0 },
        scores: { team1: 0, team2: 0 },
      }),
    ).toEqual(["reset-match-buffers", "start-countdown"]);
  });

  it("starts the countdown again when the score changes during play", () => {
    expect(
      getPongHostRuntimeEffects({
        previousPhase: "playing",
        matchPhase: "playing",
        previousScores: { team1: 0, team2: 0 },
        scores: { team1: 1, team2: 0 },
      }),
    ).toEqual(["start-countdown"]);
  });

  it("does not restart the countdown when a score change ends the match", () => {
    expect(
      getPongHostRuntimeEffects({
        previousPhase: "playing",
        matchPhase: "ended",
        previousScores: { team1: 2, team2: 0 },
        scores: { team1: 3, team2: 0 },
      }),
    ).toEqual(["clear-countdown"]);
  });
});
