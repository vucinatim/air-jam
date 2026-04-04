import { describe, expect, it } from "vitest";
import {
  createEmptyTeamCounts,
  getLobbyReadinessText,
  getMatchReadiness,
  getTeamCounts,
} from "../../../src/game/domain/match-readiness";

describe("air-capture match readiness", () => {
  it("builds empty team counts for both teams", () => {
    expect(createEmptyTeamCounts()).toEqual({
      solaris: 0,
      nebulon: 0,
    });
  });

  it("counts assignments by team", () => {
    expect(
      getTeamCounts([
        { teamId: "solaris" },
        { teamId: "nebulon" },
        { teamId: "solaris" },
      ]),
    ).toEqual({
      solaris: 2,
      nebulon: 1,
    });
  });

  it("requires at least one human player even if bots fill both teams", () => {
    expect(
      getMatchReadiness(
        { solaris: 0, nebulon: 0 },
        { solaris: 1, nebulon: 1 },
      ),
    ).toEqual({
      canStart: false,
    });
  });

  it("allows a match when one human is present and both teams are occupied", () => {
    expect(
      getMatchReadiness(
        { solaris: 1, nebulon: 0 },
        { solaris: 0, nebulon: 1 },
      ),
    ).toEqual({
      canStart: true,
    });
  });

  it("builds readiness text from the pure rule", () => {
    expect(
      getLobbyReadinessText(
        { solaris: 1, nebulon: 0 },
        { solaris: 0, nebulon: 1 },
        5,
      ),
    ).toBe("Ready. First to 5.");
  });
});
