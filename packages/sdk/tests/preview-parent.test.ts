// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ControllerRuntime } from "../src/core/controller-runtime";
import type { LocalInputTarget } from "../src/core/local-input";
import {
  AIR_JAM_PREVIEW_CLOSE_REQUEST,
  AIR_JAM_PREVIEW_CLOSE_RESULT,
} from "../src/preview/messages";
import { listenForPreviewClose } from "../src/runtime/browser-controller-environment";
import { listenForLocalSeatInput } from "../src/runtime/local-seats";

const studio = "https://studio.example";
const originalParent = window.parent;
afterEach(() => {
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: originalParent,
  });
  window.history.replaceState({}, "", "/");
});

/** Frames this page as a preview phone launched with the given query. */
const framePhone = (query: string) => {
  window.history.replaceState(
    {},
    "",
    `/controller?room=ROOM&aj_preview=1&aj_preview_device=pd_preview_1${query}`,
  );
  const parent = { postMessage: vi.fn() } as unknown as Window;
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: parent,
  });
  return parent;
};
const fromParent = (parent: Window, origin: string, data: unknown) =>
  window.dispatchEvent(
    new MessageEvent("message", { source: parent, origin, data }),
  );
const target = () =>
  ({
    press: vi.fn(() => () => {}),
    hold: vi.fn(() => () => {}),
    set: vi.fn(),
    releaseAll: vi.fn(),
  }) satisfies LocalInputTarget;
const pressJump = {
  type: "airjam.local-seat.input",
  operation: { op: "press", control: "jump", hold: 1 },
};

describe("a local-seat phone's parent", () => {
  it("takes operations only from the parent origin its launch declares", () => {
    const parent = framePhone(
      `&airjamLocalSeat=Keyboard%201&aj_preview_parent=${encodeURIComponent(studio)}`,
    );
    const controls = target();
    const stop = listenForLocalSeatInput(controls);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: "airjam.local-seat.ready" },
      studio,
    );
    fromParent(parent, window.location.origin, pressJump);
    fromParent(window, studio, pressJump);
    expect(controls.press).not.toHaveBeenCalled();
    fromParent(parent, studio, pressJump);
    expect(controls.press).toHaveBeenCalledWith("jump");
    stop();
  });

  it("takes them from its own origin when none is declared", () => {
    const parent = framePhone("&airjamLocalSeat=Keyboard%201");
    const controls = target();
    const stop = listenForLocalSeatInput(controls);
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: "airjam.local-seat.ready" },
      window.location.origin,
    );
    fromParent(parent, studio, pressJump);
    expect(controls.press).not.toHaveBeenCalled();
    fromParent(parent, window.location.origin, pressJump);
    expect(controls.press).toHaveBeenCalledWith("jump");
    stop();
  });

  it("ignores its parent unless it was launched as a seat", () => {
    const parent = framePhone(
      `&aj_preview_parent=${encodeURIComponent(studio)}`,
    );
    const controls = target();
    listenForLocalSeatInput(controls)();
    expect(parent.postMessage).not.toHaveBeenCalled();
  });
});

describe("a preview phone closing for its parent", () => {
  it("answers only its declared parent, at that origin", async () => {
    const parent = framePhone(
      `&aj_preview_parent=${encodeURIComponent(studio)}`,
    );
    const socket = { disconnect: vi.fn() };
    const runtime = {
      socket,
      isEmbedded: false,
      leave: vi.fn(async () => ({ ok: true })),
    } as unknown as ControllerRuntime;
    const disconnect = vi.fn();
    const stop = listenForPreviewClose(runtime, disconnect);
    const close = { type: AIR_JAM_PREVIEW_CLOSE_REQUEST };
    fromParent(parent, window.location.origin, close);
    fromParent(window, studio, close);
    expect(runtime.leave).not.toHaveBeenCalled();
    fromParent(parent, studio, close);
    await vi.waitFor(() =>
      expect(disconnect).toHaveBeenCalledWith("controller"),
    );
    expect(parent.postMessage).toHaveBeenCalledWith(
      { type: AIR_JAM_PREVIEW_CLOSE_RESULT, ok: true },
      studio,
    );
    expect(socket.disconnect).toHaveBeenCalled();
    stop();
  });
});
