import { describe, expect, it } from "vitest";
import { orchestrateArcadeSession } from "./arcade-session-orchestrator";
import type { ArcadeGame } from "./arcade-surface-types";

const game: ArcadeGame = {
  id: "game_1",
  slug: "one",
  name: "One",
  url: "https://games.test/one/",
  controllerUrl: "https://games.test/one/controller/",
};

const effectTypes = (effects: ReturnType<typeof orchestrateArcadeSession>) =>
  effects.map((effect) => effect.type);

describe("arcade session orchestrator", () => {
  it("resets a new room while preserving a pending replicated restore", () => {
    expect(
      effectTypes(
        orchestrateArcadeSession({
          type: "room.connected",
          roomId: "ROOM",
          connected: true,
          previousRoomId: null,
          restorePhase: "pending_restore",
          mode: "arcade",
          initialOverlay: "qr",
        }),
      ),
    ).toEqual(["runtime.reset"]);

    expect(
      effectTypes(
        orchestrateArcadeSession({
          type: "room.connected",
          roomId: "NEXT",
          connected: true,
          previousRoomId: "ROOM",
          restorePhase: "pending_restore",
          mode: "arcade",
          initialOverlay: "hidden",
        }),
      ),
    ).toEqual(["runtime.reset", "surface.reset", "surface.overlay"]);
  });

  it("plans launch request and acknowledgement as one convergent sequence", () => {
    const request = orchestrateArcadeSession({
      type: "launch.requested",
      game,
      connected: true,
      roomId: "ROOM",
      runtimeLaunchAvailable: true,
      mode: "arcade",
      hostRouteIntent: { kind: "game", gameId: game.id },
    });
    expect(effectTypes(request)).toEqual([
      "runtime.launch-start",
      "server.launch",
    ]);

    const launch = request.find((effect) => effect.type === "server.launch");
    expect(launch).toMatchObject({
      context: {
        normalizedGameUrl: "https://games.test/one/",
        controllerUrl: "https://games.test/one/controller/",
        ensureBrowserBackTarget: true,
      },
    });

    if (!launch || launch.type !== "server.launch") {
      throw new Error("Expected launch effect.");
    }

    const acknowledged = orchestrateArcadeSession({
      type: "launch.acknowledged",
      context: launch.context,
      ack: {
        ok: true,
        launchCapability: { token: "capability", expiresAt: 1_800_000_000_000 },
      },
      mode: "arcade",
    });
    expect(effectTypes(acknowledged)).toEqual([
      "surface.game",
      "surface.overlay",
      "runtime.launch-success",
      "history.game",
    ]);
  });

  it("fails invalid or rejected launches without touching replicated game state", () => {
    const invalid = orchestrateArcadeSession({
      type: "launch.requested",
      game: { ...game, controllerUrl: "javascript:alert(1)" },
      connected: true,
      roomId: "ROOM",
      runtimeLaunchAvailable: true,
      mode: "arcade",
      hostRouteIntent: { kind: "browser" },
    });
    expect(effectTypes(invalid)).toEqual([
      "runtime.launch-start",
      "runtime.launch-failure",
    ]);

    const request = orchestrateArcadeSession({
      type: "launch.requested",
      game,
      connected: true,
      roomId: "ROOM",
      runtimeLaunchAvailable: true,
      mode: "arcade",
      hostRouteIntent: { kind: "browser" },
    });
    const launch = request.find((effect) => effect.type === "server.launch");
    if (!launch || launch.type !== "server.launch") {
      throw new Error("Expected launch effect.");
    }
    expect(
      effectTypes(
        orchestrateArcadeSession({
          type: "launch.acknowledged",
          context: launch.context,
          ack: { ok: false, code: "GAME_NOT_FOUND" },
          mode: "arcade",
        }),
      ),
    ).toEqual(["runtime.launch-failure"]);
  });

  it("waits for catalog hydration and restores all authoritative surfaces together", () => {
    const restoreEvent = {
      type: "restore.requested" as const,
      session: {
        gameId: game.id,
        launchCapability: {
          token: "restored",
          expiresAt: 1_800_000_000_000,
        },
      },
      hostRouteIntent: { kind: "game" as const, gameId: game.id },
      mode: "arcade" as const,
      browserOverlay: "hidden" as const,
    };

    expect(
      orchestrateArcadeSession({
        ...restoreEvent,
        games: [],
        gamesCatalogReady: false,
      }),
    ).toEqual([]);

    expect(
      effectTypes(
        orchestrateArcadeSession({
          ...restoreEvent,
          games: [game],
          gamesCatalogReady: true,
        }),
      ),
    ).toEqual([
      "surface.game",
      "surface.overlay",
      "runtime.launch-success",
      "selection.set",
      "history.game",
      "restore.clear",
    ]);
  });

  it("fully returns to the browser when a bare arcade route rejects a restored game", () => {
    expect(
      effectTypes(
        orchestrateArcadeSession({
          type: "restore.requested",
          session: {
            gameId: game.id,
            launchCapability: {
              token: "restored",
              expiresAt: 1_800_000_000_000,
            },
          },
          hostRouteIntent: { kind: "browser" },
          games: [game],
          gamesCatalogReady: true,
          mode: "arcade",
          browserOverlay: "qr",
        }),
      ),
    ).toEqual([
      "history.browser",
      "surface.browser",
      "surface.overlay",
      "runtime.reset",
      "server.close",
      "restore.clear",
    ]);
  });

  it("fully returns to the browser when a restored game is stale after catalog hydration", () => {
    expect(
      effectTypes(
        orchestrateArcadeSession({
          type: "restore.requested",
          session: {
            gameId: "removed_game",
            launchCapability: {
              token: "restored",
              expiresAt: 1_800_000_000_000,
            },
          },
          hostRouteIntent: { kind: "game", gameId: "removed_game" },
          games: [game],
          gamesCatalogReady: true,
          mode: "arcade",
          browserOverlay: "hidden",
        }),
      ),
    ).toEqual([
      "history.browser",
      "surface.browser",
      "surface.overlay",
      "runtime.reset",
      "server.close",
      "restore.clear",
    ]);
  });

  it("maps browser history back and server child close onto the same exit convergence", () => {
    const back = orchestrateArcadeSession({
      type: "history.back",
      mode: "arcade",
      historySurface: "browser",
      surfaceKind: "game",
      browserOverlay: "qr",
    });
    expect(effectTypes(back)).toEqual([
      "history.browser",
      "surface.browser",
      "surface.overlay",
      "runtime.exit",
      "server.close",
    ]);

    const childClose = orchestrateArcadeSession({
      type: "close.requested",
      mode: "arcade",
      browserOverlay: "qr",
      notifyServer: false,
    });
    expect(effectTypes(childClose)).toEqual([
      "history.browser",
      "surface.browser",
      "surface.overlay",
      "runtime.exit",
    ]);
  });
});
