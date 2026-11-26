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
  serveEmbeddedGameSettings,
} from "../src/settings/platform-settings-bridge";

const ORIGIN = "https://platform.example";

const READY = { type: AIRJAM_SETTINGS_READY, payload: { ready: true } };

/** The frame's end of a port: it confirms the port and keeps what arrives. */
const frameEnd = (port: MessagePort) => {
  const received: unknown[] = [];
  port.addEventListener("message", (event) => received.push(event.data));
  port.start();
  port.postMessage(READY);
  return received;
};

describe("platform settings bridge", () => {
  it("sends a frame the latest settings once it confirms its port", async () => {
    const channel = new MessageChannel();
    const targetWindow = { postMessage: vi.fn() } as unknown as Window;
    const bridge = createParentPlatformSettingsBridge({
      createMessageChannel: () => channel,
    });
    const quiet = {
      ...DEFAULT_SURFACE_SETTINGS,
      audio: { volume: 0.25, music: 0.5, effects: 0.75 },
    };
    bridge.updateSettings({ ...quiet, reduceMotion: true });
    bridge.updateSettings(quiet);
    bridge.attach(targetWindow, ORIGIN);
    const received = frameEnd(channel.port2);

    await vi.waitFor(() => expect(bridge.getState()).toBe("ready"));
    await vi.waitFor(() =>
      expect(received).toEqual([
        { type: AIRJAM_SETTINGS_SYNC, payload: { settings: quiet } },
      ]),
    );
    bridge.detach();
  });

  it("answers a reloaded frame's ready with a fresh port", () => {
    const targetWindow = { postMessage: vi.fn() } as unknown as Window;
    const bridge = createParentPlatformSettingsBridge();
    const handled = bridge.handleMessage(
      new MessageEvent("message", {
        source: targetWindow as MessageEventSource,
        origin: ORIGIN,
        data: READY,
      }),
      targetWindow,
      ORIGIN,
    );
    expect(handled).toBe(true);
    const [message, origin, transfer] = vi.mocked(targetWindow.postMessage).mock
      .calls[0] as unknown as [{ type: string }, string, MessagePort[]];
    expect(message.type).toBe("AIRJAM_BRIDGE_INIT");
    expect(origin).toBe(ORIGIN);
    expect(transfer).toHaveLength(1);
    bridge.detach();
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
    frameEnd(channel.port2);
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
});
