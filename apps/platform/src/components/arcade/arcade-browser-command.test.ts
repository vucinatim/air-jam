import { AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN } from "@air-jam/sdk/arcade/surface";
import { airJamArcadePlatformActions } from "@air-jam/sdk/protocol";
import { describe, expect, it } from "vitest";
import { resolveArcadeBrowserCommand } from "./arcade-browser-command";
import { createInitialArcadeRuntimeState } from "./arcade-runtime-manager";

const commandContext = (): Parameters<
  typeof resolveArcadeBrowserCommand
>[0] => ({
  event: {
    actionName: airJamArcadePlatformActions.confirm,
    storeDomain: AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN,
    actor: { id: "player-one", role: "controller" },
    payload: { epoch: 7 },
  },
  mode: "arcade",
  surface: { kind: "browser", epoch: 7 },
  runtime: createInitialArcadeRuntimeState({ games: [] }),
  players: [{ id: "player-one" }],
  gamesLength: 4,
  now: 10_000,
});

describe("Arcade browser commands", () => {
  it("accepts current browser confirmation and directional navigation", () => {
    const context = commandContext();
    expect(resolveArcadeBrowserCommand(context)).toEqual({
      type: "confirm",
      selectedIndex: 0,
    });
    context.event.actionName = airJamArcadePlatformActions.navigate;
    context.event.payload = { epoch: 7, direction: "left" };
    expect(resolveArcadeBrowserCommand(context)).toEqual({
      type: "navigate",
      direction: "left",
    });
  });

  it.each([
    airJamArcadePlatformActions.navigate,
    airJamArcadePlatformActions.confirm,
  ])(
    "rejects %s outside its live browser surface or player authority",
    (actionName) => {
      const valid = commandContext();
      valid.event.actionName = actionName;
      valid.event.payload =
        actionName === airJamArcadePlatformActions.navigate
          ? { epoch: 7, direction: "up" }
          : { epoch: 7 };
      const invalid = [
        { ...valid, surface: { ...valid.surface, epoch: 8 } },
        { ...valid, surface: { ...valid.surface, kind: "game" as const } },
        { ...valid, mode: "preview" as const },
        { ...valid, players: [] },
        { ...valid, event: { ...valid.event, storeDomain: "game" } },
        {
          ...valid,
          event: {
            ...valid.event,
            actor: { id: "player-one", role: "host" as const },
          },
        },
        { ...valid, runtime: { ...valid.runtime, isLaunching: true } },
        {
          ...valid,
          runtime: {
            ...valid.runtime,
            launchCapability: { token: "test", expiresAt: 20_000 },
          },
        },
        { ...valid, gamesLength: 0 },
      ];
      for (const context of invalid)
        expect(resolveArcadeBrowserCommand(context)).toBeNull();
    },
  );

  it("rejects malformed, unknown, and legacy input payloads", () => {
    const context = commandContext();
    for (const payload of [
      undefined,
      { epoch: 0 },
      { epoch: 7.5 },
      { epoch: 6 },
      { epoch: 7, action: true },
    ]) {
      context.event.payload = payload;
      expect(resolveArcadeBrowserCommand(context)).toBeNull();
    }
    context.event.actionName = airJamArcadePlatformActions.navigate;
    context.event.payload = { epoch: 7, direction: "diagonal" };
    expect(resolveArcadeBrowserCommand(context)).toBeNull();
    context.event.payload = { epoch: 7, vector: { x: 1, y: 0 } };
    expect(resolveArcadeBrowserCommand(context)).toBeNull();
    context.event.actionName = "game.start";
    context.event.payload = { epoch: 7 };
    expect(resolveArcadeBrowserCommand(context)).toBeNull();
  });

  it("requires a bounded current selection and respects the exit cooldown only for confirm", () => {
    const context = commandContext();
    for (const selectedIndex of [-1, 4, 0.5, NaN]) {
      context.runtime.selectedIndex = selectedIndex;
      expect(resolveArcadeBrowserCommand(context)).toBeNull();
    }
    context.runtime.selectedIndex = 3;
    context.runtime.lastExitAt = context.now - 499;
    expect(resolveArcadeBrowserCommand(context)).toBeNull();
    context.event.actionName = airJamArcadePlatformActions.navigate;
    context.event.payload = { epoch: 7, direction: "up" };
    expect(resolveArcadeBrowserCommand(context)?.type).toBe("navigate");
    context.event.actionName = airJamArcadePlatformActions.confirm;
    context.event.payload = { epoch: 7 };
    context.now += 1;
    expect(resolveArcadeBrowserCommand(context)).toEqual({
      type: "confirm",
      selectedIndex: 3,
    });
  });
});
