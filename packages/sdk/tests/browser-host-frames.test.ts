// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { createBrowserHostEnvironment } from "../src/runtime/browser-host-environment";

afterEach(() => vi.unstubAllGlobals());
it("does not schedule another browser frame when the callback stops its loop", () => {
  let next: FrameRequestCallback = () => {};
  const request = vi.fn((callback: FrameRequestCallback) => {
    next = callback;
    return 1;
  });
  const cancel = vi.fn();
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const environment = createBrowserHostEnvironment();
  const stop = environment.frames!(() => stop());
  next(10);
  expect(request).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledWith(1);
});
