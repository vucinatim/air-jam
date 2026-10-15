import { JSDOM } from "jsdom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AIR_JAM_PREVIEW_CLOSE_REQUEST,
  AIR_JAM_PREVIEW_CLOSE_RESULT,
  requestPreviewControllerClose,
} from "../src/preview/messages";

let dom: JSDOM;
beforeEach(() => {
  vi.useFakeTimers();
  dom = new JSDOM("<iframe></iframe>", { url: "https://studio.test/" });
  vi.stubGlobal("window", dom.window);
});
afterEach(() => {
  dom.window.close();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const controllerUrl = "https://game.test/controller?room=ABCD";
function frame() {
  const iframe = dom.window.document.querySelector("iframe");
  if (!iframe?.contentWindow) throw new Error("Controller fixture missing.");
  const source = iframe.contentWindow;
  const posted = vi.spyOn(source, "postMessage").mockImplementation(() => {});
  return { iframe, source, posted };
}

it("waits for the correct controller and origin to acknowledge its leave", async () => {
  const { iframe, source, posted } = frame();
  const completed = vi.fn();
  const closing = requestPreviewControllerClose(iframe, controllerUrl);
  void closing.then(completed);
  expect(posted).toHaveBeenCalledWith(
    { type: AIR_JAM_PREVIEW_CLOSE_REQUEST },
    "https://game.test",
  );
  for (const [origin, sender] of [
    ["https://other.test", source],
    ["https://game.test", window],
  ] as const) {
    dom.window.dispatchEvent(
      new dom.window.MessageEvent("message", {
        origin,
        source: sender,
        data: { type: AIR_JAM_PREVIEW_CLOSE_RESULT, ok: true },
      }),
    );
  }
  await Promise.resolve();
  expect(completed).not.toHaveBeenCalled();
  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", {
      origin: "https://game.test",
      source,
      data: { type: AIR_JAM_PREVIEW_CLOSE_RESULT, ok: true },
    }),
  );
  expect(await closing).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

it("reports a refused leave and times out an unresponsive controller", async () => {
  const { iframe, source } = frame();
  const closing = requestPreviewControllerClose(iframe, controllerUrl);
  dom.window.dispatchEvent(
    new dom.window.MessageEvent("message", {
      origin: "https://game.test",
      source,
      data: { type: AIR_JAM_PREVIEW_CLOSE_RESULT, ok: false },
    }),
  );
  expect(await closing).toBe(false);
  const unresponsive = requestPreviewControllerClose(iframe, controllerUrl);
  await vi.advanceTimersByTimeAsync(1000);
  expect(await unresponsive).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it("does not claim a controller left when its frame is unavailable", async () => {
  expect(await requestPreviewControllerClose(null, controllerUrl)).toBe(false);
});
