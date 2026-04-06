// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useControllerTick } from "../src/hooks/use-controller-tick";
import { useHostTick } from "../src/hooks/use-host-tick";

const mockedScope = vi.hoisted(() => ({
  useAssertSessionScope: vi.fn(),
}));

vi.mock("../src/context/session-scope", () => ({
  useAssertSessionScope: mockedScope.useAssertSessionScope,
}));

describe("tick hooks", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("runs useControllerTick at fixed interval and stops on unmount", () => {
    const calls: number[] = [];
    const { unmount } = renderHook(() =>
      useControllerTick(
        ({ tick }) => {
          calls.push(tick);
        },
        { intervalMs: 10 },
      ),
    );

    act(() => {
      vi.advanceTimersByTime(35);
    });

    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(calls[0]).toBe(1);

    const callCountBeforeUnmount = calls.length;
    unmount();

    act(() => {
      vi.advanceTimersByTime(40);
    });

    expect(calls.length).toBe(callCountBeforeUnmount);
  });

  it("runs useHostTick in interval mode and stops on unmount", () => {
    const deltas: number[] = [];
    const { unmount } = renderHook(() =>
      useHostTick(
        ({ deltaMs }) => {
          deltas.push(deltaMs);
        },
        { mode: "interval", intervalMs: 20 },
      ),
    );

    act(() => {
      vi.advanceTimersByTime(65);
    });

    expect(deltas.length).toBeGreaterThanOrEqual(3);

    const callsBeforeUnmount = deltas.length;
    unmount();

    act(() => {
      vi.advanceTimersByTime(40);
    });

    expect(deltas.length).toBe(callsBeforeUnmount);
  });

  it("runs useHostTick in raf mode and cancels frame loop on unmount", () => {
    let rafId = 0;
    const rafTimers = new Map<number, ReturnType<typeof setTimeout>>();

    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafId += 1;
      const id = rafId;
      const timer = setTimeout(() => cb(performance.now()), 16);
      rafTimers.set(id, timer);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      const timer = rafTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        rafTimers.delete(id);
      }
    });

    const ticks: number[] = [];
    const { unmount } = renderHook(() =>
      useHostTick(({ tick }) => ticks.push(tick)),
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(ticks.length).toBeGreaterThan(0);

    const callsBeforeUnmount = ticks.length;
    unmount();

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(ticks.length).toBe(callsBeforeUnmount);
  });
});
