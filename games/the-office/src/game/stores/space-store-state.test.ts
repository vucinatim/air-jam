import { describe, expect, it } from "vitest";
import {
  createInitialSpaceGameState,
  reduceRestartMatch,
  reduceReturnToLobby,
  reduceSelectCharacter,
  reduceStartMatch,
} from "./space-store-state";

describe("space store lifecycle reducers", () => {
  it("starts a fresh match from the current lobby assignments", () => {
    const selectedState = {
      ...createInitialSpaceGameState(),
      playerAssignments: {
        alpha: "michael",
        beta: "dwight",
      },
      money: {
        alpha: 80,
      },
      busyPlayers: {
        alpha: "Printer",
      },
      taskProgress: {
        alpha: 42,
      },
      playerStats: {
        alpha: { energy: 20, boredom: 12, alive: false },
      },
      gameOver: true,
    };

    const nextState = reduceStartMatch(selectedState, ["alpha", "beta"]);

    expect(nextState.matchPhase).toBe("playing");
    expect(nextState.money).toEqual({});
    expect(nextState.busyPlayers).toEqual({});
    expect(nextState.taskProgress).toEqual({});
    expect(nextState.gameOver).toBe(false);
    expect(nextState.playerStats).toEqual({
      alpha: { energy: 100, boredom: 100, alive: true },
      beta: { energy: 100, boredom: 100, alive: true },
    });
    expect(nextState.lifecycleVersion).toBe(selectedState.lifecycleVersion + 1);
  });

  it("starts a rematch with only currently connected character selections", () => {
    const endedState = {
      ...createInitialSpaceGameState(),
      matchPhase: "ended" as const,
      playerAssignments: {
        alpha: "michael",
        disconnected: "dwight",
      },
      money: {
        alpha: 120,
        disconnected: 80,
      },
      playerStats: {
        alpha: { energy: 0, boredom: 0, alive: false },
        disconnected: { energy: 0, boredom: 0, alive: false },
      },
      gameOver: true,
    };

    const lobbyState = reduceReturnToLobby(endedState, ["alpha"]);
    const nextState = reduceRestartMatch(lobbyState, ["alpha"]);

    expect(nextState.matchPhase).toBe("playing");
    expect(nextState.playerAssignments).toEqual({ alpha: "michael" });
    expect(nextState.money).toEqual({});
    expect(nextState.playerStats).toEqual({
      alpha: { energy: 100, boredom: 100, alive: true },
    });
    expect(nextState.gameOver).toBe(false);
  });

  it("returns to lobby without carrying ended-state runtime forward", () => {
    const endedState = {
      ...createInitialSpaceGameState(),
      matchPhase: "ended" as const,
      playerAssignments: {
        alpha: "michael",
        beta: "dwight",
      },
      money: {
        alpha: 120,
      },
      totalMoneyPenalty: 100,
      gameOver: true,
      playerStats: {
        alpha: { energy: 0, boredom: 0, alive: false },
      },
      busyPlayers: {
        alpha: "Printer",
      },
      taskProgress: {
        alpha: 88,
      },
    };

    const nextState = reduceReturnToLobby(endedState, ["alpha", "beta"]);

    expect(nextState.matchPhase).toBe("lobby");
    expect(nextState.playerAssignments).toEqual(endedState.playerAssignments);
    expect(nextState.money).toEqual({});
    expect(nextState.totalMoneyPenalty).toBe(0);
    expect(nextState.playerStats).toEqual({});
    expect(nextState.busyPlayers).toEqual({});
    expect(nextState.taskProgress).toEqual({});
    expect(nextState.gameOver).toBe(false);
  });

  it("prunes disconnected character selections before claiming a new one", () => {
    const baseState = {
      ...createInitialSpaceGameState(),
      playerAssignments: {
        disconnected: "spela",
      },
    };

    const nextState = reduceSelectCharacter(
      baseState,
      "alpha",
      ["alpha"],
      "spela",
    );

    expect(nextState.playerAssignments).toEqual({
      alpha: "spela",
    });
  });
});
