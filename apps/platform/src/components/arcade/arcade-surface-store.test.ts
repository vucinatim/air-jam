import { beforeEach, describe, expect, it } from "vitest";
import { useArcadeSurfaceStore } from "./arcade-surface-store";

const hostContext = {
  actorId: "host",
  role: "host" as const,
  connectedPlayerIds: [],
};

describe("arcade surface store reconnect restore", () => {
  beforeEach(() => {
    useArcadeSurfaceStore
      .getState()
      .actions.resetHostSurfaceForMode(hostContext, { mode: "arcade" });
  });

  it("creates a browser identity above the previous room epoch", () => {
    useArcadeSurfaceStore
      .getState()
      .actions.restoreHostBrowserSurface(hostContext, { previousEpoch: 4 });

    expect(useArcadeSurfaceStore.getState()).toMatchObject({
      epoch: 5,
      kind: "browser",
      gameId: null,
      controllerUrl: null,
      orientation: "portrait",
    });
  });

  it("creates a restored game identity above the previous room epoch", () => {
    useArcadeSurfaceStore
      .getState()
      .actions.restoreHostGameSurface(hostContext, {
        previousEpoch: 8,
        gameId: "pong",
        controllerUrl: "https://games.test/pong/controller",
        orientation: "landscape",
      });

    expect(useArcadeSurfaceStore.getState()).toMatchObject({
      epoch: 9,
      kind: "game",
      gameId: "pong",
      controllerUrl: "https://games.test/pong/controller",
      orientation: "landscape",
    });
  });
});
