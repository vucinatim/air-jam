// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ControllerRemoteAudioRuntime,
  useAudio,
} from "../src/audio/hooks";
import { ControllerSessionProvider } from "../src/context/session-providers";

const mocked = vi.hoisted(() => {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const socket = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const current = listeners.get(event) ?? new Set();
      current.add(handler);
      listeners.set(event, current);
      return socket;
    }),
    off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      const current = listeners.get(event);
      if (!current) {
        return socket;
      }
      current.delete(handler);
      if (current.size === 0) {
        listeners.delete(event);
      }
      return socket;
    }),
    trigger: (event: string, payload: unknown) => {
      const current = listeners.get(event);
      if (!current) {
        return;
      }
      for (const handler of current) {
        handler(payload);
      }
    },
  };

  const howlPlay = vi.fn(() => 101);

  class MockHowl {
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
    socket,
    listeners,
    howlPlay,
    useAirJamContext: vi.fn(),
    useAssertSessionScope: vi.fn(),
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
  const actual =
    await vi.importActual<typeof import("../src/context/air-jam-context")>(
      "../src/context/air-jam-context",
    );

  return {
    ...actual,
    useAirJamContext: mocked.useAirJamContext,
  };
});

vi.mock("../src/context/session-providers", async () => {
  const actual =
    await vi.importActual<typeof import("../src/context/session-providers")>(
      "../src/context/session-providers",
    );

  return {
    ...actual,
    useAssertSessionScope: mocked.useAssertSessionScope,
  };
});

describe("ControllerRemoteAudioRuntime", () => {
  const manifest: Record<"hit" | "score", { src: string[] }> = {
    hit: { src: ["/sounds/hit.wav"] },
    score: { src: ["/sounds/score.wav"] },
  };

  beforeEach(() => {
    mocked.useAirJamContext.mockReturnValue({
      getSocket: () => mocked.socket,
      store: {
        getState: () => ({ role: "controller", roomId: "room-1" }),
        subscribe: () => () => {},
      },
    });
    mocked.howlPlay.mockClear();
  });

  afterEach(() => {
    mocked.listeners.clear();
    vi.restoreAllMocks();
  });

  it("plays only manifest-known remote sounds", () => {
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(
        ControllerSessionProvider,
        null,
        createElement(ControllerRemoteAudioRuntime, { manifest, children }),
      );

    renderHook(() => useAudio<"hit" | "score">(), { wrapper });

    act(() => {
      mocked.socket.trigger("server:playSound", {
        id: "hit",
        volume: 0.5,
      });
    });
    expect(mocked.howlPlay).toHaveBeenCalledTimes(1);

    act(() => {
      mocked.socket.trigger("server:playSound", {
        id: "unknown",
        volume: 0.8,
      });
    });
    expect(mocked.howlPlay).toHaveBeenCalledTimes(1);
  });
});
