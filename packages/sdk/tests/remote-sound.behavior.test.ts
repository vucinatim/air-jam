// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AudioManager } from "../src/audio/audio-manager";
import { isManifestSoundId, useRemoteSound } from "../src/audio/hooks";

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

  return {
    socket,
    listeners,
    useAirJamContext: vi.fn(),
    useAssertSessionScope: vi.fn(),
  };
});

vi.mock("../src/context/air-jam-context", () => ({
  useAirJamContext: mocked.useAirJamContext,
}));

vi.mock("../src/context/session-providers", () => ({
  useAssertSessionScope: mocked.useAssertSessionScope,
}));

describe("useRemoteSound", () => {
  const manifest: Record<"hit" | "score", { src: string[] }> = {
    hit: { src: ["/sounds/hit.wav"] },
    score: { src: ["/sounds/score.wav"] },
  };
  const playSpy = vi.fn();
  const audio = {
    play: playSpy,
  } as unknown as AudioManager<"hit" | "score">;

  beforeEach(() => {
    mocked.useAirJamContext.mockReturnValue({
      getSocket: () => mocked.socket,
    });
    playSpy.mockReset();
  });

  afterEach(() => {
    mocked.listeners.clear();
    vi.restoreAllMocks();
  });

  it("plays only manifest-known remote sounds", () => {
    renderHook(() => useRemoteSound(manifest, audio));

    act(() => {
      mocked.socket.trigger("server:playSound", {
        id: "hit",
        volume: 0.5,
      });
    });
    expect(audio.play).toHaveBeenCalledWith("hit", {
      volume: 0.5,
      loop: undefined,
    });

    act(() => {
      mocked.socket.trigger("server:playSound", {
        id: "unknown",
        volume: 0.8,
      });
    });
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  it("provides a runtime sound ID guard helper", () => {
    expect(isManifestSoundId(manifest, "hit")).toBe(true);
    expect(isManifestSoundId(manifest, "missing")).toBe(false);
    expect(isManifestSoundId(manifest, 123)).toBe(false);
  });
});
