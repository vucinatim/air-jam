// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioRuntime, useAudio } from "../src/audio/hooks";
import { ControllerSessionProvider } from "../src/context/session-providers";
import { controllerRuntimeContext } from "../src/runtime/runtime-owner-contexts";

const mocked = vi.hoisted(() => {
  const listeners = new Set<(signal: unknown) => void>();
  const signal = (value: unknown) => {
    for (const listener of listeners) listener(value);
  };

  const howlPlay = vi.fn(() => 101);

  class MockHowl {
    unload = vi.fn();
    play = howlPlay;
    volume = vi.fn();
    loop = vi.fn();
    rate = vi.fn();
    once = vi.fn();
    stop = vi.fn();
    pos = vi.fn();
    pannerAttr = vi.fn();
    mute = vi.fn();
  }

  return {
    signal,
    listeners,
    howlPlay,
    useAirJamContext: vi.fn(),
    MockHowl,
  };
});

vi.mock("howler", () => ({
  Howl: mocked.MockHowl,
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

vi.mock("../src/context/air-jam-context", async () => {
  const actual = await vi.importActual<
    typeof import("../src/context/air-jam-context")
  >("../src/context/air-jam-context");

  return {
    ...actual,
    useAirJamContext: mocked.useAirJamContext,
  };
});

describe("AudioRuntime controller remote sound playback", () => {
  const manifest: Record<"hit" | "score", { src: string[] }> = {
    hit: { src: ["/sounds/hit.wav"] },
    score: { src: ["/sounds/score.wav"] },
  };

  beforeEach(() => {
    mocked.useAirJamContext.mockReturnValue({
      store: {
        getState: () => ({
          role: "controller",
          roomId: "room-1",
          connectionStatus: "connected",
        }),
        subscribe: () => () => {},
      },
    });
    mocked.howlPlay.mockClear();
  });

  afterEach(() => {
    mocked.listeners.clear();
    vi.restoreAllMocks();
  });

  it("plays only manifest-known remote sounds", async () => {
    const session = {
      on: (_event: "signal", listener: (signal: unknown) => void) => {
        mocked.listeners.add(listener);
        return () => mocked.listeners.delete(listener);
      },
    };
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        ControllerSessionProvider,
        null,
        createElement(
          controllerRuntimeContext.Provider,
          { value: { session } },
          createElement(AudioRuntime, { manifest, children }),
        ),
      );

    renderHook(() => useAudio<"hit" | "score">(), { wrapper });
    await act(async () => {});

    act(() => {
      mocked.signal({
        kind: "sound",
        payload: { soundId: "hit", volume: 0.5 },
      });
    });
    expect(mocked.howlPlay).toHaveBeenCalledTimes(1);

    act(() => {
      mocked.signal({
        kind: "sound",
        payload: { soundId: "unknown", volume: 0.8 },
      });
    });
    expect(mocked.howlPlay).toHaveBeenCalledTimes(1);
  });
});
