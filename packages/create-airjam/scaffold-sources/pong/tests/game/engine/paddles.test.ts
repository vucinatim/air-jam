import { describe, expect, it } from "vitest";
import { getBotPositions, createEmptyBotCounts } from "../../../src/game/domain/team-slots";
import { getTeamPaddleState } from "../../../src/game/engine/paddles";

describe("paddle occupancy", () => {
  it("fills remaining team slots with bots after human assignments", () => {
    const botCounts = {
      team1: 1,
      team2: 2,
    };
    const players = [{ id: "playerA" }, { id: "playerB" }];
    const teamAssignments = {
      playerA: { team: "team1" as const, position: "front" as const },
      playerB: { team: "team2" as const, position: "front" as const },
    };

    expect(getBotPositions(teamAssignments, botCounts, "team1")).toEqual(["back"]);
    expect(getBotPositions(teamAssignments, botCounts, "team2")).toEqual(["back"]);
    expect(
      getTeamPaddleState(players, teamAssignments, botCounts),
    ).toEqual({
      team1: { hasFront: true, hasBack: true },
      team2: { hasFront: true, hasBack: true },
    });
  });

  it("keeps a team empty when neither humans nor bots occupy it", () => {
    expect(
      getTeamPaddleState([], {}, createEmptyBotCounts()),
    ).toEqual({
      team1: { hasFront: false, hasBack: false },
      team2: { hasFront: false, hasBack: false },
    });
  });
});
