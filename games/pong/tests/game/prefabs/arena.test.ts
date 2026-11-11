import { describe, expect, it } from "vitest";
import { resolvePongArenaProps } from "../../../src/game/prefabs/arena";

describe("arena prefab", () => {
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
