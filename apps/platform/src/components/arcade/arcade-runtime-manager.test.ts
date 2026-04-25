import { describe, expect, it } from "vitest";
import {
  ARCADE_BROWSER_PATH,
  createInitialArcadeRuntimeState,
  getArcadeGameHistoryPath,
  getArcadeHistorySurface,
  getAutoLaunchRequestKey,
  getInitialSelectedIndex,
  getNextSelectedIndex,
  normalizeArcadeHistoryPathname,
  reduceArcadeRuntimeState,
  shouldAutoLaunchGame,
} from "./arcade-runtime-manager";
import type { ArcadeGame } from "./arcade-system";

const games: ArcadeGame[] = [
  {
    id: "g1",
    name: "One",
    url: "https://game-one.test",
    controllerUrl: "https://game-one.test/controller",
  },
  {
    id: "g2",
    name: "Two",
    url: "https://game-two.test",
    controllerUrl: "https://game-two.test/controller",
  },
  {
    id: "g3",
    name: "Three",
    url: "https://game-three.test",
    controllerUrl: "https://game-three.test/controller",
  },
  {
    id: "g4",
    name: "Four",
    url: "https://game-four.test",
    controllerUrl: "https://game-four.test/controller",
  },
];

describe("arcade runtime manager", () => {
  it("models arcade browser and game history paths", () => {
    expect(ARCADE_BROWSER_PATH).toBe("/arcade");
    expect(getArcadeGameHistoryPath(games[0]!)).toBe("/arcade/g1");
    expect(getArcadeGameHistoryPath({ ...games[0]!, slug: "local-one" })).toBe(
      "/arcade/local-one",
    );

    expect(getArcadeHistorySurface("/arcade")).toBe("browser");
    expect(getArcadeHistorySurface("/arcade/")).toBe("browser");
    expect(getArcadeHistorySurface("/arcade/local-one")).toBe("game");
    expect(getArcadeHistorySurface("/play/local-one")).toBe("outside");
    expect(normalizeArcadeHistoryPathname("/arcade/local-one/")).toBe(
      "/arcade/local-one",
    );
  });

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
      initialGameId: "g2",
    });

    state = reduceArcadeRuntimeState(state, {
      type: "consume-auto-launch",
      requestKey: "arcade:g2",
    });
    state = reduceArcadeRuntimeState(state, { type: "launch-start" });
    state = reduceArcadeRuntimeState(state, {
      type: "launch-success",
      normalizedGameUrl: "https://game-two.test",
      launchCapability: {
        token: "join_abc",
        expiresAt: 1_700_000_000_000,
      },
    });

    expect(state.launchCapability?.token).toBe("join_abc");

    state = reduceArcadeRuntimeState(state, {
      type: "exit-game",
      exitedAt: 123_456,
    });

    expect(state.launchCapability).toBeNull();
    expect(state.isLaunching).toBe(false);
    expect(state.consumedAutoLaunchRequestKey).toBe("arcade:g2");
    expect(state.lastExitAt).toBe(123_456);
    expect(state.browserActionLaunchBlocked).toBe(true);
  });

  it("blocks browser action relaunch after exit until controller actions are released", () => {
    let state = createInitialArcadeRuntimeState({
      games,
      initialGameId: "g2",
    });

    state = reduceArcadeRuntimeState(state, {
      type: "exit-game",
      exitedAt: 123_456,
    });

    expect(state.browserActionLaunchBlocked).toBe(true);

    state = reduceArcadeRuntimeState(state, {
      type: "browser-action-release-observed",
    });

    expect(state.browserActionLaunchBlocked).toBe(false);
  });

  it("clears stale launch state on session reset without applying exit cooldown", () => {
    let state = createInitialArcadeRuntimeState({
      games,
      initialGameId: "g2",
    });

    state = reduceArcadeRuntimeState(state, {
      type: "consume-auto-launch",
      requestKey: "arcade:g2",
    });
    state = reduceArcadeRuntimeState(state, { type: "launch-start" });
    state = reduceArcadeRuntimeState(state, {
      type: "launch-success",
      normalizedGameUrl: "https://game-two.test",
      launchCapability: {
        token: "join_stale",
        expiresAt: 1_700_000_000_000,
      },
    });

    state = reduceArcadeRuntimeState(state, { type: "reset-session" });

    expect(state.launchCapability).toBeNull();
    expect(state.normalizedGameUrl).toBe("");
    expect(state.isLaunching).toBe(false);
    expect(state.consumedAutoLaunchRequestKey).toBeNull();
    expect(state.lastExitAt).toBe(0);
    expect(state.browserActionLaunchBlocked).toBe(false);
  });

  it("derives a stable auto-launch request key per route intent", () => {
    expect(
      getAutoLaunchRequestKey({
        mode: "arcade",
        autoLaunch: true,
        initialGameId: "g2",
      }),
    ).toBe("arcade:g2");

    expect(
      getAutoLaunchRequestKey({
        mode: "arcade",
        autoLaunch: false,
        initialGameId: "g2",
      }),
    ).toBeNull();

    expect(
      getAutoLaunchRequestKey({
        mode: "preview",
        autoLaunch: false,
        initialGameId: undefined,
      }),
    ).toBe("preview:__first__");
  });

  it("computes auto-launch eligibility using surface kind (browser) not runtime activeGame", () => {
    expect(
      shouldAutoLaunchGame({
        autoLaunchRequestKey: null,
        consumedAutoLaunchRequestKey: null,
        isConnected: true,
        roomId: "ABCD",
        surfaceKind: "browser",
        isLaunching: false,
        hasLaunchCapability: false,
        gamesLength: 1,
      }),
    ).toBe(false);

    expect(
      shouldAutoLaunchGame({
        autoLaunchRequestKey: "arcade:g1",
        consumedAutoLaunchRequestKey: null,
        isConnected: true,
        roomId: "ABCD",
        surfaceKind: "browser",
        isLaunching: false,
        hasLaunchCapability: false,
        gamesLength: 1,
      }),
    ).toBe(true);

    expect(
      shouldAutoLaunchGame({
        autoLaunchRequestKey: "arcade:g1",
        consumedAutoLaunchRequestKey: "arcade:g1",
        isConnected: true,
        roomId: "ABCD",
        surfaceKind: "browser",
        isLaunching: false,
        hasLaunchCapability: false,
        gamesLength: 1,
      }),
    ).toBe(false);

    expect(
      shouldAutoLaunchGame({
        autoLaunchRequestKey: "arcade:g1",
        consumedAutoLaunchRequestKey: null,
        isConnected: true,
        roomId: "ABCD",
        surfaceKind: "game",
        isLaunching: false,
        hasLaunchCapability: false,
        gamesLength: 1,
      }),
    ).toBe(false);

    expect(
      shouldAutoLaunchGame({
        autoLaunchRequestKey: "preview:__first__",
        consumedAutoLaunchRequestKey: "preview:__first__",
        isConnected: true,
        roomId: "ABCD",
        surfaceKind: "browser",
        isLaunching: false,
        hasLaunchCapability: false,
        gamesLength: 1,
      }),
    ).toBe(false);
  });
});
