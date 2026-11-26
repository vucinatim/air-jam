// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AIRJAM_HOST_REVEAL,
  HoldReveal,
  readHostReveal,
  RevealGate,
} from "../src/runtime/host-reveal";

const parent = () => ({
  window: { postMessage: vi.fn() },
  origin: "https://arcade.test",
});

const Gate = ({
  target,
  connected = true,
  holding = false,
}: {
  target: ReturnType<typeof parent>;
  connected?: boolean;
  holding?: boolean;
}) => (
  <RevealGate
    parent={target as unknown as { window: Window; origin: string }}
    connected={connected}
  >
    {holding && <HoldReveal />}
  </RevealGate>
);

const paint = async () => {
  await act(async () => {
    await Promise.resolve();
    vi.advanceTimersByTime(64);
  });
};

describe("host reveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      setTimeout(() => callback(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (handle: number) =>
      clearTimeout(handle),
    );
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reveals once, only after the room connects and every hold is released", async () => {
    const target = parent();
    const view = render(<Gate target={target} connected={false} holding />);
    await paint();
    view.rerender(<Gate target={target} holding />);
    await paint();
    expect(target.window.postMessage).not.toHaveBeenCalled();

    view.rerender(<Gate target={target} />);
    await paint();
    expect(target.window.postMessage).toHaveBeenCalledExactlyOnceWith(
      { type: AIRJAM_HOST_REVEAL },
      "https://arcade.test",
    );

    view.rerender(<Gate target={target} holding />);
    view.rerender(<Gate target={target} />);
    await paint();
    expect(target.window.postMessage).toHaveBeenCalledTimes(1);
  });

  it("the parent accepts a reveal only from its own frame and origin", () => {
    const frame = {} as Window;
    const reveal = (source: unknown, origin: string) =>
      new MessageEvent("message", {
        data: { type: AIRJAM_HOST_REVEAL },
        origin,
        source: source as Window,
      });
    expect(
      readHostReveal(
        reveal(frame, "https://game.test"),
        frame,
        "https://game.test",
      ),
    ).toBe(true);
    expect(
      readHostReveal(
        reveal({}, "https://game.test"),
        frame,
        "https://game.test",
      ),
    ).toBe(false);
    expect(
      readHostReveal(
        reveal(frame, "https://other.test"),
        frame,
        "https://game.test",
      ),
    ).toBe(false);
  });
});
