import { beforeEach, describe, expect, it, vi } from "vitest";
import { MATCH_POINTS_TO_WIN } from "../../../src/game/domain/match-rules";
import {
  codeReviewSimulation,
  type CodeReviewSimulationEvent,
  type CodeReviewSimulationState,
} from "../../../src/game/engine/code-review-simulation";

const fixture = vi.hoisted(() => ({
  state: {
    matchPhase: "lobby" as "lobby" | "playing" | "ended",
    scores: { team1: 0, team2: 0 },
    teamAssignments: {} as Record<
      string,
      { team: "team1" | "team2"; position: "front" | "back" }
    >,
    botCounts: { team1: 0, team2: 1 },
  },
  actions: {
    syncConnectedPlayers: vi.fn(),
    scorePoint: vi.fn(),
    finishMatch: vi.fn(),
  },
}));

vi.mock("../../../src/game/stores", () => ({
  gameStore: { getState: () => fixture.state, actions: fixture.actions },
}));

const players = [{ id: "ctrl_1", label: "One", color: "#000000" }];

describe("Code Review simulation", () => {
  let sim: CodeReviewSimulationState;
  let events: CodeReviewSimulationEvent[];

  const step = () =>
    codeReviewSimulation.step(sim, {
      tick: 1,
      stepMs: codeReviewSimulation.stepMs,
      dtSeconds: codeReviewSimulation.stepMs / 1000,
      random: () => 0,
      input: () => ({
        vertical: 0,
        horizontal: 0,
        leftPunch: false,
        rightPunch: false,
        defend: false,
      }),
      players,
      emit: (event) => events.push(event),
    });

  beforeEach(() => {
    vi.clearAllMocks();
    fixture.state.matchPhase = "lobby";
    fixture.state.scores = { team1: 0, team2: 0 };
    fixture.state.teamAssignments = {
      ctrl_1: { team: "team1", position: "front" },
    };
    sim = codeReviewSimulation.create({ random: () => 0 });
    events = [];
  });

  it("seats the assigned player and the bot, and syncs the roster once", () => {
    step();
    step();
    expect(sim.participants.map((participant) => participant.id)).toEqual([
      "ctrl_1",
      expect.any(String),
    ]);
    expect(sim.participants[1].isBot).toBe(true);
    expect(fixture.actions.syncConnectedPlayers).toHaveBeenCalledTimes(1);
  });

  it("runs the fight clock only while a match plays", () => {
    step();
    expect(sim.clockMs).toBe(0);
    fixture.state.matchPhase = "playing";
    for (let index = 0; index < 60; index += 1) step();
    expect(sim.clockMs).toBeCloseTo(1000);
  });

  it("ends the match once a team reaches the winning score", () => {
    fixture.state.matchPhase = "playing";
    step();
    expect(fixture.actions.finishMatch).not.toHaveBeenCalled();
    fixture.state.scores = { team1: MATCH_POINTS_TO_WIN, team2: 0 };
    step();
    expect(fixture.actions.finishMatch).toHaveBeenCalledTimes(1);
  });

  it("observes every fighter for agents", () => {
    fixture.state.matchPhase = "playing";
    step();
    expect(
      codeReviewSimulation.observe?.(sim, {
        controllerId: null,
        scope: "diagnostic",
      }),
    ).toMatchObject({
      hp: { team1: expect.any(Number), team2: expect.any(Number) },
      knockout: { active: false },
      fighters: [
        expect.objectContaining({ playerId: "ctrl_1", isBot: false }),
        expect.objectContaining({ isBot: true }),
      ],
    });
  });
});
