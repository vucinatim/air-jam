// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ControllerCaptureSurface } from "../src/components/controller-capture-surface";
import { readPreviewControllerParent } from "../src/preview/identity";
import { supportsControllerCapture } from "../src/runtime/controller-capture";

vi.mock("../src/preview/identity", () => ({
  AIR_JAM_PREVIEW_CAPTURE_QUERY_PARAM: "aj_preview_capture",
  readPreviewControllerParent: vi.fn(),
}));
vi.mock("../src/runtime/controller-capture", () => ({
  supportsControllerCapture: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

it("keeps real phones and unsupported previews in their original DOM", () => {
  vi.mocked(readPreviewControllerParent).mockReturnValue(null);
  vi.mocked(supportsControllerCapture).mockReturnValue(true);
  const real = render(
    <ControllerCaptureSurface>
      <button>Play</button>
    </ControllerCaptureSurface>,
  );
  expect(real.container.firstElementChild?.tagName).toBe("BUTTON");
  real.unmount();
  window.history.replaceState(null, "", "/?aj_preview_capture=1");
  vi.mocked(readPreviewControllerParent).mockReturnValue({
    window,
    origin: window.location.origin,
  });
  vi.mocked(supportsControllerCapture).mockReturnValue(false);
  const preview = render(
    <ControllerCaptureSurface>
      <button>Play</button>
    </ControllerCaptureSurface>,
  );
  expect(preview.container.firstElementChild?.tagName).toBe("BUTTON");
});

it("mounts one native preview surface and preserves its controls across capability changes", () => {
  window.history.replaceState(null, "", "/?aj_preview_capture=1");
  vi.mocked(readPreviewControllerParent).mockReturnValue({
    window,
    origin: window.location.origin,
  });
  vi.mocked(supportsControllerCapture).mockReturnValue(true);
  const reset = vi.fn();
  const drawElementImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    reset,
    drawElementImage,
  } as unknown as CanvasRenderingContext2D);
  Object.defineProperty(HTMLCanvasElement.prototype, "requestPaint", {
    configurable: true,
    value: vi.fn(),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  const tap = vi.fn();
  const children = <button onClick={tap}>Play</button>;
  const view = render(
    <ControllerCaptureSurface>{children}</ControllerCaptureSurface>,
  );
  const canvas = view.container.querySelector("canvas")!;
  const button = view.getByRole("button", { name: "Play" });
  button.focus();
  fireEvent.click(button);
  fireEvent(canvas, new Event("paint"));
  expect(document.activeElement).toBe(button);
  expect(tap).toHaveBeenCalledOnce();
  expect(drawElementImage).toHaveBeenCalledWith(
    canvas.firstElementChild,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  vi.mocked(supportsControllerCapture).mockReturnValue(false);
  window.history.replaceState(null, "", "/");
  view.rerender(
    <ControllerCaptureSurface>{children}</ControllerCaptureSurface>,
  );
  expect(view.container.querySelector("canvas")).toBe(canvas);
  expect(view.getByRole("button")).toBe(button);
  delete (HTMLCanvasElement.prototype as unknown as { requestPaint?: unknown })
    .requestPaint;
});
