import { describe, expect, it } from "vitest";
import {
  createMatchWinnerToastSignal,
  createPaddleHitHapticSignal,
} from "../../../src/game/adapters/controller-signals";

describe("controller signal adapters", () => {
  it("keeps targeted paddle-hit haptics in one reusable payload helper", () => {
    expect(createPaddleHitHapticSignal()).toEqual({ pattern: "light" });
  });

  it("builds the controller toast payload for match-end announcements", () => {
    expect(
      createMatchWinnerToastSignal("team2", {
        winner: "team2",
        finalScores: { team1: 3, team2: 5 },
        durationMs: 18_500,
        pointsToWin: 5,
      }),
    ).toEqual({
      message: "Nebulon wins 3-5",
      color: "#38bdf8",
      duration: 2200,
    });
  });
});
