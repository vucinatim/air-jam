// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  AIRJAM_SETTINGS_READY,
  AIRJAM_SETTINGS_SYNC,
} from "../src/runtime/iframe-bridge";
import { DEFAULT_PLATFORM_SETTINGS } from "../src/settings/platform-settings";
import {
  createParentPlatformSettingsBridge,
  initializeInheritedPlatformSettingsBridge,
} from "../src/settings/platform-settings-bridge";

describe("platform settings bridge", () => {
  it("flushes only the latest pending snapshot after child readiness", () => {
    const port1 = {
      postMessage: vi.fn(),
      close: vi.fn(),
      start: vi.fn(),
    } as unknown as MessagePort;
    const port2 = {} as MessagePort;
    const targetWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;

    const bridge = createParentPlatformSettingsBridge({
      createMessageChannel: () => ({ port1, port2 }) as MessageChannel,
    });

    bridge.attach(targetWindow, "https://platform.example");
    bridge.updateSettings({
      ...DEFAULT_PLATFORM_SETTINGS,
      audio: {
        masterVolume: 0.8,
        musicVolume: 0.6,
        sfxVolume: 0.4,
      },
    });
    bridge.updateSettings({
      ...DEFAULT_PLATFORM_SETTINGS,
      audio: {
        masterVolume: 0.25,
        musicVolume: 0.5,
        sfxVolume: 0.75,
      },
    });

    expect(port1.postMessage).not.toHaveBeenCalled();

    bridge.handleMessage(
      new MessageEvent("message", {
        source: targetWindow as MessageEventSource,
        origin: "https://platform.example",
        data: {
          type: AIRJAM_SETTINGS_READY,
          payload: {
            ready: true,
          },
        },
      }),
      targetWindow,
      "https://platform.example",
    );

    expect(bridge.getState()).toBe("ready");
    expect(port1.postMessage).toHaveBeenCalledWith({
      type: AIRJAM_SETTINGS_SYNC,
      payload: {
        settings: {
          ...DEFAULT_PLATFORM_SETTINGS,
          audio: {
            masterVolume: 0.25,
            musicVolume: 0.5,
            sfxVolume: 0.75,
          },
        },
      },
    });
    expect(targetWindow.postMessage).toHaveBeenLastCalledWith(
      {
        type: AIRJAM_SETTINGS_SYNC,
        payload: {
          settings: {
            ...DEFAULT_PLATFORM_SETTINGS,
            audio: {
              masterVolume: 0.25,
              musicVolume: 0.5,
              sfxVolume: 0.75,
            },
          },
        },
      },
      "https://platform.example",
    );
  });

  it("flushes the pending snapshot when child readiness arrives before attach", () => {
    const port1 = {
      postMessage: vi.fn(),
      close: vi.fn(),
      start: vi.fn(),
    } as unknown as MessagePort;
    const port2 = {} as MessagePort;
    const targetWindow = {
      postMessage: vi.fn(),
    } as unknown as Window;

    const bridge = createParentPlatformSettingsBridge({
      createMessageChannel: () => ({ port1, port2 }) as MessageChannel,
    });

    bridge.updateSettings({
      ...DEFAULT_PLATFORM_SETTINGS,
      audio: {
        masterVolume: 0.2,
        musicVolume: 0.05,
        sfxVolume: 0.9,
      },
    });

    bridge.handleMessage(
      new MessageEvent("message", {
        source: targetWindow as MessageEventSource,
        origin: "https://platform.example",
        data: {
          type: AIRJAM_SETTINGS_READY,
          payload: {
            ready: true,
          },
        },
      }),
      targetWindow,
      "https://platform.example",
    );

    expect(port1.postMessage).not.toHaveBeenCalled();

    bridge.attach(targetWindow, "https://platform.example");

    expect(bridge.getState()).toBe("ready");
    expect(port1.postMessage).toHaveBeenCalledWith({
      type: AIRJAM_SETTINGS_SYNC,
      payload: {
        settings: {
          ...DEFAULT_PLATFORM_SETTINGS,
          audio: {
            masterVolume: 0.2,
            musicVolume: 0.05,
            sfxVolume: 0.9,
          },
        },
      },
    });
  });

  it("applies fallback window.postMessage snapshots in embedded runtimes", () => {
    const originalParent = window.parent;
    const parentWindow = {
      postMessage: vi.fn(),
    };
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: parentWindow,
    });
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://platform.example/arcade",
    });

    const applySettings = vi.fn();
    const cleanup = initializeInheritedPlatformSettingsBridge({
      applySettings,
    });

    expect(parentWindow.postMessage).toHaveBeenCalledWith(
      {
        type: AIRJAM_SETTINGS_READY,
        payload: { ready: true },
      },
      "https://platform.example",
    );

    window.dispatchEvent(
      new MessageEvent("message", {
        source: parentWindow as unknown as MessageEventSource,
        origin: "https://platform.example",
        data: {
          type: AIRJAM_SETTINGS_SYNC,
          payload: {
            settings: {
              ...DEFAULT_PLATFORM_SETTINGS,
              feedback: {
                hapticsEnabled: false,
              },
            },
          },
        },
      }),
    );

    expect(applySettings).toHaveBeenCalledWith({
      ...DEFAULT_PLATFORM_SETTINGS,
      feedback: {
        hapticsEnabled: false,
      },
    });

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
