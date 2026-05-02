import { describe, expect, it } from "vitest";
import {
  createEmptyBotCounts,
  getBotPositions,
} from "../../../src/game/domain/team-slots";
import {
  applyBotPaddleInput,
  getTeamPaddleState,
} from "../../../src/game/engine/paddles";
import type { RuntimeState } from "../../../src/game/engine/types";

const createRuntimeState = (
  overrides: Partial<RuntimeState> = {},
): RuntimeState => ({
  paddle1FrontY: 100,
  paddle1BackY: 100,
  paddle2FrontY: 100,
  paddle2BackY: 100,
  ballX: 200,
  ballY: 146.5,
  ballVX: 360,
  ballVY: 360,
  lastTouchedTeam: null,
  ...overrides,
});

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

    expect(getBotPositions(teamAssignments, botCounts, "team1")).toEqual([
      "back",
    ]);
    expect(getBotPositions(teamAssignments, botCounts, "team2")).toEqual([
      "back",
    ]);
    expect(getTeamPaddleState(players, teamAssignments, botCounts)).toEqual({
      team1: { hasFront: true, hasBack: true },
      team2: { hasFront: true, hasBack: true },
    });
  });

  it("keeps a team empty when neither humans nor bots occupy it", () => {
    expect(getTeamPaddleState([], {}, createEmptyBotCounts())).toEqual({
      team1: { hasFront: false, hasBack: false },
      team2: { hasFront: false, hasBack: false },
    });
  });

  it("clamps bot movement at the target instead of overshooting", () => {
    const state = createRuntimeState();

    applyBotPaddleInput(state, {}, { team1: 1, team2: 0 }, 1 / 60);

    expect(state.paddle1FrontY).toBe(104);
  });
});
