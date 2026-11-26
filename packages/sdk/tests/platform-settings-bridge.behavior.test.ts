// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  defineAirJamSettings,
  HostSettings,
  setting,
} from "../src/core/settings";
import {
  AIRJAM_SETTINGS_READY,
  AIRJAM_SETTINGS_SYNC,
  type AirJamGameSettingsState,
} from "../src/runtime/iframe-bridge";
import { publishEmbeddedGameSettings } from "../src/settings/embedded-game-settings";
import { DEFAULT_SURFACE_SETTINGS } from "../src/settings/platform-settings";
import {
  createParentPlatformSettingsBridge,
  initializeInheritedPlatformSettingsBridge,
  serveEmbeddedGameSettings,
} from "../src/settings/platform-settings-bridge";

const ORIGIN = "https://platform.example";

const readyEvent = (source: Window) =>
  new MessageEvent("message", {
    source: source as MessageEventSource,
    origin: ORIGIN,
    data: { type: AIRJAM_SETTINGS_READY, payload: { ready: true } },
  });

describe("platform settings bridge", () => {
  it("sends the game only the latest settings, once it is ready", () => {
    const port1 = {
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      close: vi.fn(),
      start: vi.fn(),
    } as unknown as MessagePort;
    const targetWindow = { postMessage: vi.fn() } as unknown as Window;
    const bridge = createParentPlatformSettingsBridge({
      createMessageChannel: () =>
        ({ port1, port2: {} as MessagePort }) as MessageChannel,
    });
    bridge.attach(targetWindow, ORIGIN);
    const quiet = {
      ...DEFAULT_SURFACE_SETTINGS,
      audio: { volume: 0.25, music: 0.5, effects: 0.75 },
    };
    bridge.updateSettings({ ...quiet, reduceMotion: true });
    bridge.updateSettings(quiet);
    expect(port1.postMessage).not.toHaveBeenCalled();

    bridge.handleMessage(readyEvent(targetWindow), targetWindow, ORIGIN);

    expect(port1.postMessage).toHaveBeenCalledTimes(1);
    expect(port1.postMessage).toHaveBeenCalledWith({
      type: AIRJAM_SETTINGS_SYNC,
      payload: { settings: quiet },
    });
  });

  it("carries a framed game's declared settings to the platform and the platform's changes back", async () => {
    const channel = new MessageChannel();
    const states: Array<AirJamGameSettingsState | null> = [];
    const targetWindow = { postMessage: vi.fn() } as unknown as Window;
    const bridge = createParentPlatformSettingsBridge({
      createMessageChannel: () => channel,
      onGameSettings: (state) => states.push(state),
    });
    bridge.attach(targetWindow, ORIGIN);
    const stopServing = serveEmbeddedGameSettings(channel.port2);
    channel.port2.start();
    const host = new HostSettings(
      defineAirJamSettings({
        speed: setting.number({ default: 1, min: 1, max: 3, live: true }),
      }),
    );
    const stopOffering = publishEmbeddedGameSettings({
      declaration: host.declaration,
      read: host.read,
      subscribe: host.subscribe,
      update: (patch, revision) => host.update(patch, revision, () => {}),
    });

    await vi.waitFor(() =>
      expect(states.at(-1)).toMatchObject({
        values: { speed: 1 },
        revision: 0,
      }),
    );
    expect(states.at(-1)?.declaration.speed).toMatchObject({ kind: "number" });

    await bridge.updateGameSettings({ speed: 2 }, 0);
    await vi.waitFor(() =>
      expect(states.at(-1)).toMatchObject({
        values: { speed: 2 },
        revision: 1,
      }),
    );
    await expect(bridge.updateGameSettings({ speed: 9 }, 1)).rejects.toThrow(
      /AJ_SETTING_INVALID/,
    );

    stopOffering();
    stopServing();
    bridge.detach();
    expect(states.at(-1)).toBeNull();
  });

  it("applies settings a parent posts to its window when no port is bound", () => {
    const originalParent = window.parent;
    const parentWindow = { postMessage: vi.fn() };
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: parentWindow,
    });
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: `${ORIGIN}/arcade`,
    });
    const applySettings = vi.fn();
    const cleanup = initializeInheritedPlatformSettingsBridge({
      applySettings,
    });
    const settings = { ...DEFAULT_SURFACE_SETTINGS, vibration: false };

    window.dispatchEvent(
      new MessageEvent("message", {
        source: parentWindow as unknown as MessageEventSource,
        origin: ORIGIN,
        data: { type: AIRJAM_SETTINGS_SYNC, payload: { settings } },
      }),
    );

    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      { type: AIRJAM_SETTINGS_READY, payload: { ready: true } },
      ORIGIN,
    );
    expect(applySettings).toHaveBeenCalledWith(settings);
    cleanup();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: originalParent,
    });
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "",
    });
  });
});
