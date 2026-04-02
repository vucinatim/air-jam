import { describe, expect, it } from "vitest";
import {
  MAX_TEAM_SLOTS,
  buildTeamSlots,
  clampBotCount,
  getEffectiveTeamCounts,
  getMaxBotsForTeam,
} from "../../../src/game/domain/team-slots";

describe("air-capture team slots", () => {
  it("caps bot counts to the team slot limit", () => {
    expect(clampBotCount(-1)).toBe(0);
    expect(clampBotCount(1.2)).toBe(1);
    expect(clampBotCount(99)).toBe(MAX_TEAM_SLOTS);
  });

  it("derives max bots from remaining human slots", () => {
    expect(getMaxBotsForTeam(0)).toBe(2);
    expect(getMaxBotsForTeam(1)).toBe(1);
    expect(getMaxBotsForTeam(2)).toBe(0);
    expect(getMaxBotsForTeam(3)).toBe(0);
  });

  it("builds mixed human bot and open slots deterministically", () => {
    const slots = buildTeamSlots(
      [
        {
          id: "p1",
          label: "Pilot One",
          color: "#fff",
        },
      ],
      1,
    );

    expect(slots).toEqual([
      {
        kind: "human",
        player: {
          id: "p1",
          label: "Pilot One",
          color: "#fff",
        },
      },
      { kind: "bot" },
    ]);
  });

  it("builds open slots when a team is not full", () => {
    expect(buildTeamSlots([], 0)).toEqual([{ kind: "open" }, { kind: "open" }]);
  });

  it("combines human and bot team counts", () => {
    expect(
      getEffectiveTeamCounts(
        { solaris: 1, nebulon: 0 },
        { solaris: 0, nebulon: 2 },
      ),
    ).toEqual({
      solaris: 1,
      nebulon: 2,
    });
  });
});
