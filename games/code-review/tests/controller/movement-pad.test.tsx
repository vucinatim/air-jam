// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MovementPad } from "../../src/controller/components/movement-pad";

describe("Code Review touch movement", () => {
  let root: Root;
  let container: HTMLDivElement;
  const move = vi.fn();
  const button = (name: string) =>
    container.querySelector<HTMLButtonElement>(`[aria-label="Move ${name}"]`)!;
  const pointer = (name: string, type: string, pointerId = 1) =>
    act(() => {
      button(name).dispatchEvent(
        new PointerEvent(type, { bubbles: true, pointerId, button: 0 }),
      );
    });
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("PointerEvent", window.PointerEvent);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    move.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<MovementPad onMove={move} />));
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  it.each([
    ["up", { x: 0, y: -1 }],
    ["down", { x: 0, y: 1 }],
    ["left", { x: -1, y: 0 }],
    ["right", { x: 1, y: 0 }],
  ] as const)(
    "maps %s by button meaning, independent of screen rotation",
    (direction, vector) => {
      pointer(direction, "pointerdown");
      expect(move).toHaveBeenLastCalledWith(vector);
      pointer(direction, "pointerup");
      expect(move).toHaveBeenLastCalledWith({ x: 0, y: 0 });
    },
  );
  it("ignores secondary touches and their release", () => {
    pointer("up", "pointerdown", 1);
    pointer("left", "pointerdown", 2);
    pointer("left", "pointerup", 2);
    expect(move).toHaveBeenCalledTimes(1);
    pointer("up", "pointercancel", 1);
    expect(move).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });
  it("supports keyboard hold/release without repeat pulses", () => {
    const key = (type: string, repeat = false) =>
      act(() =>
        button("left").dispatchEvent(
          new KeyboardEvent(type, { key: " ", bubbles: true, repeat }),
        ),
      );
    key("keydown");
    key("keydown", true);
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenLastCalledWith({ x: -1, y: 0 });
    key("keyup");
    expect(move).toHaveBeenLastCalledWith({ x: 0, y: 0 });
  });
  it.each(["blur", "visibilitychange", "lostpointercapture"])(
    "releases on %s and allows a new gesture",
    (event) => {
      pointer("right", "pointerdown");
      act(() => {
        if (event === "lostpointercapture")
          button("right").dispatchEvent(
            new PointerEvent(event, { bubbles: true, pointerId: 1 }),
          );
        else if (event === "blur") window.dispatchEvent(new Event(event));
        else document.dispatchEvent(new Event(event));
      });
      expect(move).toHaveBeenLastCalledWith({ x: 0, y: 0 });
      pointer("up", "pointerdown", 2);
      expect(move).toHaveBeenLastCalledWith({ x: 0, y: -1 });
    },
  );
});
