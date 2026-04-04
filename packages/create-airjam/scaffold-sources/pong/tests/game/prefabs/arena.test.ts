import { describe, expect, it } from "vitest";
import {
  PONG_ARENA_PREFAB,
  resolvePongArenaProps,
} from "../../../src/game/prefabs/arena";

describe("arena prefab", () => {
  it("keeps metadata, preview, and runtime hooks on a stable prefab contract", () => {
    expect(PONG_ARENA_PREFAB.id).toBe("pong.arena.default");
    expect(PONG_ARENA_PREFAB.preview.summary).toContain("Pong arena");
    expect(typeof PONG_ARENA_PREFAB.paint).toBe("function");
  });

  it("merges nested team-color overrides without losing the default contract", () => {
    expect(
      resolvePongArenaProps({
        fieldWidth: 1200,
        teamColors: { team1: "#111111" },
      }),
    ).toEqual({
      fieldWidth: 1200,
      fieldHeight: 600,
      backgroundColor: "#09090b",
      centerLineColor: "#3f3f46",
      teamColors: {
        team1: "#111111",
        team2: "#38bdf8",
      },
    });
  });
});
