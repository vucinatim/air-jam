// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useControllerTick } from "../src/hooks/use-controller-tick";

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
});
