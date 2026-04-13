import { describe, expect, it } from "vitest";
import {
  clearPlayerTaskState,
  createDefaultPlayerStats,
  markPlayerDead,
  mergePlayerStatUpdates,
  mergeRecordUpdates,
  pruneRecord,
  restorePlayerStat,
  setRecordValue,
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

  it("returns the original record reference when no entries are pruned", () => {
    const record = {
      alpha: 1,
      gamma: 3,
    };

    expect(pruneRecord(record, new Set(["alpha", "gamma", "delta"]))).toBe(record);
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

  it("preserves task-state references when there is nothing to clear", () => {
    const busyPlayers = { beta: "Coffee" };
    const taskProgress = { beta: 20 };

    expect(clearPlayerTaskState(busyPlayers, taskProgress, "alpha")).toEqual({
      busyPlayers,
      taskProgress,
    });
  });

  it("preserves record identity when setting the same value", () => {
    const record = { alpha: 1 };

    expect(setRecordValue(record, "alpha", 1)).toBe(record);
  });

  it("merges only changed record values", () => {
    const record = { alpha: 1, beta: 2 };

    expect(mergeRecordUpdates(record, { alpha: 1, beta: 3 })).toEqual({
      alpha: 1,
      beta: 3,
    });
  });

  it("preserves record identity when batch record updates are unchanged", () => {
    const record = { alpha: 1, beta: 2 };

    expect(mergeRecordUpdates(record, { alpha: 1 })).toBe(record);
  });

  it("merges only changed player stat fields", () => {
    expect(
      mergePlayerStatUpdates(
        {
          alpha: { energy: 90, boredom: 80, alive: true },
        },
        {
          alpha: { energy: 75 },
          beta: { boredom: 60 },
        },
      ),
    ).toEqual({
      alpha: { energy: 75, boredom: 80, alive: true },
      beta: { energy: 100, boredom: 60, alive: true },
    });
  });

  it("preserves player-stat identity when batch updates are unchanged", () => {
    const playerStats = {
      alpha: { energy: 90, boredom: 80, alive: true },
    };

    expect(
      mergePlayerStatUpdates(playerStats, {
        alpha: { energy: 90 },
      }),
    ).toBe(playerStats);
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
