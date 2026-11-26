// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ROOM_SETTINGS,
  type PlatformSurface,
  type RoomSettingsValues,
} from "../src/settings/platform-settings";
import {
  PlatformSettingsRuntime,
  usePlatformSettings,
} from "../src/settings/platform-settings-runtime";
import { readAirJamSurfaceSettings } from "../src/settings/surface-settings";

const owner = (surface: PlatformSurface, room?: RoomSettingsValues) =>
  renderHook(() => usePlatformSettings(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(PlatformSettingsRuntime, { surface, room, children }),
  });

describe("PlatformSettingsRuntime", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("style");
  });

  it("lets a screen change the room's sound and its own display, remembered on the device and seen by the whole page", () => {
    const { result } = owner("screen");
    act(() => {
      result.current.setRoom({ muted: true, music: 0.4 });
      result.current.setDevice({ interfaceSize: "Large", reduceMotion: true });
    });

    expect(readAirJamSurfaceSettings()).toMatchObject({
      audio: { volume: 0, music: 0.4 },
      interfaceScale: 1.15,
      reduceMotion: true,
    });
    expect(document.documentElement.style.fontSize).toBe("115%");
    expect(document.documentElement.hasAttribute("data-aj-reduce-motion")).toBe(
      true,
    );
    expect(owner("screen").result.current.room.music).toBe(0.4);
  });

  it("gives a phone its own controller sounds and the room's values as the screen shares them", () => {
    const { result } = owner("phone", {
      ...DEFAULT_ROOM_SETTINGS,
      volume: 0.2,
      controllerOpacity: 0.5,
    });
    act(() => result.current.setDevice({ controllerSounds: 0.3 }));

    expect(readAirJamSurfaceSettings()).toMatchObject({
      audio: { volume: 0.3 },
      controllerOpacity: 0.5,
    });
    expect(() => result.current.setRoom({ volume: 1 })).toThrow(/screen/);
  });
});
