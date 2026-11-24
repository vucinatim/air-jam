// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useControllerToasts } from "../src/hooks/use-controller-toasts";
import { controllerRuntimeContext } from "../src/runtime/runtime-owner-contexts";

vi.mock("../src/context/session-scope", () => ({
  useAssertSessionScope: vi.fn(),
}));

/** A seat's session that delivers the signals a test fires. */
const renderToasts = (options?: Parameters<typeof useControllerToasts>[0]) => {
  type Listener = (signal: { kind: string; payload: unknown }) => void;
  const listeners = new Set<Listener>();
  const session = {
    on: (_event: "signal", listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      controllerRuntimeContext.Provider,
      { value: { session } },
      children,
    );
  const rendered = renderHook(() => useControllerToasts(options), { wrapper });
  const signal = (kind: string, payload: unknown) =>
    act(() => {
      for (const listener of listeners) listener({ kind, payload });
    });
  return { ...rendered, signal };
};

describe("useControllerToasts", () => {
  afterEach(() => vi.useRealTimers());

  it("queues toast signals and auto-dismisses by duration", () => {
    vi.useFakeTimers();
    const { result, signal } = renderToasts({ defaultDurationMs: 1000 });
    signal("toast", { message: "Solaris wins", duration: 250 });
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

  it("ignores signals that are not toasts", () => {
    const { result, signal } = renderToasts();
    signal("haptic", { pattern: "light" });
    expect(result.current.toasts).toEqual([]);
  });
});
