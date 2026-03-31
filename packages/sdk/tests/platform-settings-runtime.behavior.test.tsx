// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PLATFORM_SETTINGS,
  LEGACY_AUDIO_SETTINGS_STORAGE_KEY,
  PLATFORM_SETTINGS_STORAGE_KEY,
} from "../src/settings/platform-settings";
import {
  PlatformSettingsRuntime,
  useInheritedPlatformSettings,
  usePlatformAudioSettings,
  usePlatformSettings,
} from "../src/settings/platform-settings-runtime";

describe("PlatformSettingsRuntime", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses deterministic defaults without persisted storage", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PlatformSettingsRuntime, { persistence: "local" }, children);

    const { result } = renderHook(() => usePlatformSettings(), { wrapper });

    expect(result.current.settings).toEqual(DEFAULT_PLATFORM_SETTINGS);
  });

  it("migrates legacy audio storage into platform settings storage", () => {
    window.localStorage.setItem(
      LEGACY_AUDIO_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        masterVolume: 0.3,
        musicVolume: 0.6,
        sfxVolume: 0.9,
      }),
    );

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PlatformSettingsRuntime, { persistence: "local" }, children);

    const { result } = renderHook(() => usePlatformSettings(), { wrapper });

    expect(result.current.settings.audio).toEqual({
      masterVolume: 0.3,
      musicVolume: 0.6,
      sfxVolume: 0.9,
    });
    expect(window.localStorage.getItem(LEGACY_AUDIO_SETTINGS_STORAGE_KEY)).toBe(
      null,
    );
    expect(
      JSON.parse(
        window.localStorage.getItem(PLATFORM_SETTINGS_STORAGE_KEY) ?? "null",
      ),
    ).toEqual(result.current.settings);
  });

  it("persists owner updates to local storage", async () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PlatformSettingsRuntime, { persistence: "local" }, children);

    const { result } = renderHook(() => usePlatformAudioSettings(), { wrapper });

    act(() => {
      result.current.setMusicVolume(0.35);
    });

    await waitFor(() => {
      expect(
        JSON.parse(
          window.localStorage.getItem(PLATFORM_SETTINGS_STORAGE_KEY) ?? "null",
        ),
      ).toEqual({
        ...DEFAULT_PLATFORM_SETTINGS,
        audio: {
          ...DEFAULT_PLATFORM_SETTINGS.audio,
          musicVolume: 0.35,
        },
      });
    });
  });

  it("syncs owner runtimes from platform settings storage changes in other windows", async () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PlatformSettingsRuntime, { persistence: "local" }, children);

    const { result } = renderHook(() => usePlatformAudioSettings(), { wrapper });

    act(() => {
      window.localStorage.setItem(
        PLATFORM_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          ...DEFAULT_PLATFORM_SETTINGS,
          audio: {
            masterVolume: 0.45,
            musicVolume: 0.25,
            sfxVolume: 0.9,
          },
        }),
      );

      window.dispatchEvent(
        new StorageEvent("storage", {
          key: PLATFORM_SETTINGS_STORAGE_KEY,
          newValue: window.localStorage.getItem(PLATFORM_SETTINGS_STORAGE_KEY),
          storageArea: window.localStorage,
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.masterVolume).toBe(0.45);
      expect(result.current.musicVolume).toBe(0.25);
      expect(result.current.sfxVolume).toBe(0.9);
    });
  });

  it("throws when inherited settings are read outside a runtime", () => {
    expect(() => renderHook(() => useInheritedPlatformSettings())).toThrow(
      "useInheritedPlatformSettings must be used within a PlatformSettingsRuntime",
    );
  });

  it("throws when owner settings are requested from an inherited runtime", () => {
    const originalParent = window.parent;
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: {},
    });
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://platform.example/arcade",
    });

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PlatformSettingsRuntime, null, children);

    try {
      expect(() => renderHook(() => usePlatformSettings(), { wrapper })).toThrow(
        "usePlatformSettings can only be used in a platform-owned settings runtime. Mount <PlatformSettingsRuntime persistence=\"local\"> in the platform shell.",
      );
    } finally {
      Object.defineProperty(window, "parent", {
        configurable: true,
        value: originalParent,
      });
      Object.defineProperty(document, "referrer", {
        configurable: true,
        value: "",
      });
    }
  });

  it("replaces inherited settings atomically from iframe sync messages", async () => {
    const originalParent = window.parent;
    const mockParent = {
      postMessage: vi.fn(),
    };
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: mockParent,
    });
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://platform.example/arcade",
    });

    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(PlatformSettingsRuntime, null, children);

    try {
      const { result } = renderHook(() => useInheritedPlatformSettings(), {
        wrapper,
      });

      act(() => {
        window.dispatchEvent(
          new MessageEvent("message", {
            origin: "https://platform.example",
            source: mockParent as MessageEventSource,
            data: {
              type: "AIRJAM_SETTINGS_SYNC",
              payload: {
                settings: {
                  audio: {
                    masterVolume: 0.25,
                    musicVolume: 0.5,
                    sfxVolume: 0.75,
                  },
                  accessibility: {
                    reducedMotion: true,
                    highContrast: true,
                  },
                  feedback: {
                    hapticsEnabled: false,
                  },
                },
              },
            },
          }),
        );
      });

      await waitFor(() => {
        expect(result.current).toEqual({
          audio: {
            masterVolume: 0.25,
            musicVolume: 0.5,
            sfxVolume: 0.75,
          },
          accessibility: {
            reducedMotion: true,
            highContrast: true,
          },
          feedback: {
            hapticsEnabled: false,
          },
        });
      });

      expect(window.localStorage.getItem(PLATFORM_SETTINGS_STORAGE_KEY)).toBe(
        null,
      );
    } finally {
      Object.defineProperty(window, "parent", {
        configurable: true,
        value: originalParent,
      });
      Object.defineProperty(document, "referrer", {
        configurable: true,
        value: "",
      });
    }
  });
});
