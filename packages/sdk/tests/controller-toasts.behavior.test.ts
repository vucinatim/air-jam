// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useControllerToasts } from "../src/hooks/use-controller-toasts";

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

describe("useControllerToasts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocked.useAirJamContext.mockReturnValue({
      getSocket: () => mocked.socket,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    mocked.listeners.clear();
    vi.restoreAllMocks();
  });

  it("queues toast signals and auto-dismisses by duration", () => {
    const { result } = renderHook(() =>
      useControllerToasts({
        defaultDurationMs: 1000,
      }),
    );

    act(() => {
      mocked.socket.trigger("server:signal", {
        type: "TOAST",
        payload: {
          message: "Solaris wins",
          duration: 250,
        },
      });
    });

    expect(result.current.latestToast?.message).toBe("Solaris wins");
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(249);
    });
    expect(result.current.toasts).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.toasts).toHaveLength(0);
    expect(result.current.latestToast).toBeNull();
  });

  it("ignores non-toast signals", () => {
    const { result } = renderHook(() => useControllerToasts());

    act(() => {
      mocked.socket.trigger("server:signal", {
        type: "HAPTIC",
        payload: { pattern: "light" },
      });
    });

    expect(result.current.toasts).toEqual([]);
    expect(result.current.latestToast).toBeNull();
  });
});
