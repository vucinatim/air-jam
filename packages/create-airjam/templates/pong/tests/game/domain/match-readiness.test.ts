import { describe, expect, it } from "vitest";
import {
  getLobbyReadinessText,
  getMatchReadiness,
} from "../../../src/game/domain/match-readiness";

describe("match readiness", () => {
  it("requires at least one occupied slot on each team", () => {
    expect(
      getMatchReadiness({ team1: 0, team2: 0 }, {
        team1: 0,
        team2: 1,
      }),
    ).toEqual({
      canStart: false,
      missingTeam: "team1",
    });
  });

  it("allows mixed human and bot occupancy", () => {
    expect(
      getMatchReadiness({ team1: 1, team2: 0 }, {
        team1: 1,
        team2: 1,
      }),
    ).toEqual({
      canStart: true,
      missingTeam: null,
    });
  });

  it("builds host readiness text from the pure rule", () => {
    expect(
      getLobbyReadinessText(
        { team1: 1, team2: 0 },
        { team1: 0, team2: 1 },
        5,
        "host",
      ),
    ).toBe("Ready. First to 5. Start on phone.");
  });
});
