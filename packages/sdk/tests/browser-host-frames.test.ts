// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { resolveRuntimeTopology } from "../src/runtime-topology";
import { resolveAirJamConfig } from "../src/runtime/air-jam-config";
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
  const environment = createBrowserHostEnvironment(
    resolveAirJamConfig({
      topology: resolveRuntimeTopology({
        runtimeMode: "standalone-dev",
        surfaceRole: "host",
        appOrigin: window.location.origin,
        backendOrigin: window.location.origin,
        publicHost: window.location.origin,
      }),
      resolveEnv: false,
    }),
  );
  const stop = environment.frames!(() => stop());
  next(10);
  expect(request).toHaveBeenCalledOnce();
  expect(cancel).toHaveBeenCalledWith(1);
});
