import { describe, expect, it } from "vitest";
import {
  buildTeamSlots,
  createEmptyBotCounts,
  getEffectiveTeamCounts,
} from "../../../src/game/domain/team-slots";

describe("team slots", () => {
  it("builds fixed slot visuals from ordered humans and bot count", () => {
    const slots = buildTeamSlots(
      [
        { id: "p1", label: "Alex" },
      ],
      1,
    );

    expect(slots).toEqual([
      {
        kind: "human",
        player: { id: "p1", label: "Alex" },
      },
      { kind: "bot" },
    ]);
  });

  it("fills remaining capacity with open slots", () => {
    expect(buildTeamSlots([], 0)).toEqual([{ kind: "open" }, { kind: "open" }]);
  });

  it("combines human and bot counts into effective occupancy", () => {
    expect(
      getEffectiveTeamCounts(
        { team1: 1, team2: 0 },
        createEmptyBotCounts(),
      ),
    ).toEqual({ team1: 1, team2: 0 });
  });
});
