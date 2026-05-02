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
      useHostTick({
        onTick: ({ deltaMs }) => {
          deltas.push(deltaMs);
        },
        mode: "interval",
        intervalMs: 20,
      }),
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
      useHostTick({
        onTick: ({ tick }) => ticks.push(tick),
      }),
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

  it("runs useHostTick in fixed mode with stable simulation deltas", () => {
    let rafId = 0;
    const rafTimers = new Map<number, ReturnType<typeof setTimeout>>();
    const frameDelays = [8, 24, 40, 16];

    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafId += 1;
      const id = rafId;
      const delay = frameDelays.shift() ?? 16;
      const timer = setTimeout(() => cb(performance.now()), delay);
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

    const calls: Array<{
      deltaMs: number;
      deltaSeconds: number;
      tick: number;
    }> = [];
    const { unmount } = renderHook(() =>
      useHostTick({
        onTick: (info) => calls.push(info),
        mode: "fixed",
        intervalMs: 10,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(80);
    });

    expect(calls).toHaveLength(7);
    expect(calls.map((call) => call.tick)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(calls.every((call) => call.deltaMs === 10)).toBe(true);
    expect(calls.every((call) => call.deltaSeconds === 0.01)).toBe(true);

    unmount();
    const callsBeforeUnmount = calls.length;

    act(() => {
      vi.advanceTimersByTime(40);
    });

    expect(calls).toHaveLength(callsBeforeUnmount);
  });

  it("runs useHostTick fixed render frames on every RAF", () => {
    let rafId = 0;
    const rafTimers = new Map<number, ReturnType<typeof setTimeout>>();
    const frameDelays = [5, 5, 5, 5];

    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      rafId += 1;
      const id = rafId;
      const delay = frameDelays.shift() ?? 5;
      const timer = setTimeout(() => cb(performance.now()), delay);
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

    const simulationTicks: number[] = [];
    const renderFrames: Array<{ frame: number; fixedStepAlpha: number }> = [];
    const { unmount } = renderHook(() =>
      useHostTick({
        onTick: ({ tick }) => simulationTicks.push(tick),
        mode: "fixed",
        intervalMs: 10,
        onFrame: ({ frame, fixedStepAlpha }) => {
          renderFrames.push({ frame, fixedStepAlpha });
        },
      }),
    );

    act(() => {
      vi.advanceTimersByTime(20);
    });

    expect(renderFrames.map((frame) => frame.frame)).toEqual([1, 2, 3, 4]);
    expect(simulationTicks).toEqual([1, 2]);
    expect(renderFrames.map((frame) => frame.fixedStepAlpha)).toEqual([
      0.5, 0, 0.5, 0,
    ]);

    unmount();
  });
});
