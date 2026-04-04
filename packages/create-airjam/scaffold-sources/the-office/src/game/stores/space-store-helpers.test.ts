import { describe, expect, it } from "vitest";
import {
  clearPlayerTaskState,
  createDefaultPlayerStats,
  markPlayerDead,
  pruneRecord,
  restorePlayerStat,
} from "./space-store-helpers";

describe("space store helpers", () => {
  it("prunes records down to connected players", () => {
    expect(
      pruneRecord(
        {
          alpha: 1,
          beta: 2,
          gamma: 3,
        },
        new Set(["alpha", "gamma"]),
      ),
    ).toEqual({
      alpha: 1,
      gamma: 3,
    });
  });

  it("clears busy state and task progress for one player", () => {
    expect(
      clearPlayerTaskState(
        { alpha: "Printer", beta: "Coffee" },
        { alpha: 45, beta: 20 },
        "alpha",
      ),
    ).toEqual({
      busyPlayers: { beta: "Coffee" },
      taskProgress: { beta: 20 },
    });
  });

  it("caps restored stats at 100", () => {
    expect(
      restorePlayerStat(
        { energy: 95, boredom: 70, alive: true },
        "energy",
        10,
      ),
    ).toEqual({
      energy: 100,
      boredom: 70,
      alive: true,
    });
  });

  it("marks a player dead and drains their stats", () => {
    expect(
      markPlayerDead({
        energy: 40,
        boredom: 25,
        alive: true,
      }),
    ).toEqual({
      energy: 0,
      boredom: 0,
      alive: false,
    });
  });

  it("creates the default player state", () => {
    expect(createDefaultPlayerStats()).toEqual({
      energy: 100,
      boredom: 100,
      alive: true,
    });
  });
});
