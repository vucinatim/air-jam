// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { AudioManager } from "../src/audio/audio-manager";
import { AudioProvider, useProvidedAudio } from "../src/audio/hooks";

vi.mock("howler", () => ({
  Howl: class MockHowl {
    play = vi.fn(() => 1);
    volume = vi.fn();
    loop = vi.fn();
    rate = vi.fn();
    once = vi.fn();
    stop = vi.fn();
    pos = vi.fn();
    pannerAttr = vi.fn();
    mute = vi.fn();
  },
  Howler: {
    ctx: {
      state: "running",
      resume: vi.fn(),
    },
    stop: vi.fn(),
    volume: vi.fn(),
    mute: vi.fn(),
    pos: vi.fn(),
    orientation: vi.fn(),
  },
}));

describe("AudioProvider", () => {
  it("returns the runtime-owned manager to consumers", () => {
    const manager = new AudioManager({
      hit: { src: ["/sounds/hit.wav"] },
    });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(AudioProvider, { manager, children });

    const { result } = renderHook(() => useProvidedAudio<"hit">(), {
      wrapper,
    });

    expect(result.current).toBe(manager);
  });

  it("throws outside an audio provider", () => {
    expect(() => renderHook(() => useProvidedAudio())).toThrow(
      "useProvidedAudio must be used within an AudioProvider",
    );
  });
});
