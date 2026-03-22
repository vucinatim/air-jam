import { describe, expect, it } from "vitest";
import type { ArcadeGame } from "./arcade-system";
import {
  createInitialArcadeRuntimeState,
  getInitialSelectedIndex,
  getNextSelectedIndex,
  reduceArcadeRuntimeState,
  shouldAutoLaunchGame,
} from "./arcade-runtime-manager";

const games: ArcadeGame[] = [
  { id: "g1", name: "One", url: "https://game-one.test" },
  { id: "g2", name: "Two", url: "https://game-two.test" },
  { id: "g3", name: "Three", url: "https://game-three.test" },
  { id: "g4", name: "Four", url: "https://game-four.test" },
];

describe("arcade runtime manager", () => {
  it("initializes selected game from initialGameId", () => {
    expect(getInitialSelectedIndex(games, "g3")).toBe(2);
    expect(getInitialSelectedIndex(games, "missing")).toBe(0);
    expect(getInitialSelectedIndex([], "g1")).toBe(0);
  });

  it("navigates selection with wrap-around by vector", () => {
    expect(
      getNextSelectedIndex({
        selectedIndex: 0,
        vector: { x: 1, y: 0 },
        columns: 2,
        gamesLength: games.length,
      }),
    ).toBe(1);

    expect(
      getNextSelectedIndex({
        selectedIndex: 3,
        vector: { x: 1, y: 0 },
        columns: 2,
        gamesLength: games.length,
      }),
    ).toBe(0);

    expect(
      getNextSelectedIndex({
        selectedIndex: 1,
        vector: { x: 0, y: 1 },
        columns: 2,
        gamesLength: games.length,
      }),
    ).toBe(3);

    expect(
      getNextSelectedIndex({
        selectedIndex: 0,
        vector: { x: 0, y: -1 },
        columns: 2,
        gamesLength: games.length,
      }),
    ).toBe(2);
  });

  it("tracks launch and exit transitions without stale runtime state", () => {
    let state = createInitialArcadeRuntimeState({
      games,
      mode: "arcade",
      initialGameId: "g2",
    });

    state = reduceArcadeRuntimeState(state, { type: "mark-auto-launched" });
    state = reduceArcadeRuntimeState(state, { type: "launch-start" });
    state = reduceArcadeRuntimeState(state, {
      type: "launch-success",
      gameId: "g2",
      normalizedGameUrl: "https://game-two.test",
      joinToken: "join_abc",
    });

    expect(state.view).toBe("game");
    expect(state.activeGameId).toBe("g2");
    expect(state.joinToken).toBe("join_abc");

    state = reduceArcadeRuntimeState(state, {
      type: "exit-game",
      exitedAt: 123_456,
    });

    expect(state.view).toBe("browser");
    expect(state.activeGameId).toBeNull();
    expect(state.joinToken).toBeNull();
    expect(state.isLaunching).toBe(false);
    expect(state.hasAutoLaunched).toBe(false);
    expect(state.lastExitAt).toBe(123_456);
  });

  it("computes auto-launch eligibility from explicit runtime conditions", () => {
    expect(
      shouldAutoLaunchGame({
        mode: "arcade",
        autoLaunch: false,
        hasAutoLaunched: false,
        isConnected: true,
        roomId: "ABCD",
        hasActiveGame: false,
        isLaunching: false,
        hasJoinToken: false,
        gamesLength: 1,
      }),
    ).toBe(false);

    expect(
      shouldAutoLaunchGame({
        mode: "arcade",
        autoLaunch: true,
        hasAutoLaunched: false,
        isConnected: true,
        roomId: "ABCD",
        hasActiveGame: false,
        isLaunching: false,
        hasJoinToken: false,
        gamesLength: 1,
      }),
    ).toBe(true);

    expect(
      shouldAutoLaunchGame({
        mode: "preview",
        autoLaunch: false,
        hasAutoLaunched: true,
        isConnected: true,
        roomId: "ABCD",
        hasActiveGame: false,
        isLaunching: false,
        hasJoinToken: false,
        gamesLength: 1,
      }),
    ).toBe(false);
  });
});
