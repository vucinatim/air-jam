// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOfficeControllerInput } from "../../src/controller/use-office-controller-input";

const sdk = vi.hoisted(() => ({
  write: vi.fn(),
  tick: undefined as (() => void) | undefined,
  enabled: false,
  socket: { connected: true },
}));
vi.mock("@air-jam/sdk", () => ({
  useAirJamController: () => ({ socket: sdk.socket }),
  useInputWriter: () => sdk.write,
  useControllerTick: (tick: () => void, options: { enabled: boolean }) => {
    sdk.tick = tick;
    sdk.enabled = options.enabled;
  },
}));

const initial = {
  connected: true,
  enabled: true,
  lifecycleVersion: 1,
  controllerId: "player",
  busy: false,
};
function Harness(props: typeof initial) {
  if (!props.enabled || !props.connected) return null;
  return (
    <Controls
      key={`${props.controllerId}:${props.lifecycleVersion}`}
      busy={props.busy}
    />
  );
}
function Controls({ busy }: { busy: boolean }) {
  const input = useOfficeControllerInput({ busy });
  return (
    <>
      <div data-pad {...input.padBindings}>
        <span data-origin ref={input.originRef} />
        <span data-right ref={input.rightRef} />
        <span data-bottom ref={input.bottomRef} />
      </div>
      <button {...input.workBindings}>WORK</button>
      <output>{JSON.stringify(input.padDirection)}</output>
    </>
  );
}

describe("Office controller input lifecycle", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    sdk.write.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    render();
    sdk.write.mockClear();
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  function render(overrides: Partial<typeof initial> = {}) {
    sdk.socket.connected = overrides.connected ?? initial.connected;
    act(() => root.render(<Harness {...initial} {...overrides} />));
    for (const [selector, x, y] of [
      ["[data-origin]", 0, 0],
      ["[data-right]", 300, 0],
      ["[data-bottom]", 0, 240],
    ] as const) {
      const element = container.querySelector(selector);
      if (element)
        vi.spyOn(element, "getBoundingClientRect").mockReturnValue(
          new DOMRect(x, y, 0, 0),
        );
    }
    for (const element of [pad(), work()])
      if (element) element.setPointerCapture = vi.fn();
  }
  const pad = () => container.querySelector<HTMLDivElement>("[data-pad]")!;
  const work = () => container.querySelector<HTMLButtonElement>("button")!;
  const pointer = (
    target: HTMLElement,
    type: string,
    id = 1,
    x = 280,
    y = 120,
  ) => {
    const event = new MouseEvent(type, {
      bubbles: true,
      clientX: x,
      clientY: y,
      button: 0,
    });
    Object.defineProperty(event, "pointerId", { value: id });
    act(() => target.dispatchEvent(event));
  };
  const key = (type: string, value: string, repeat = false) =>
    act(() =>
      work().dispatchEvent(
        new KeyboardEvent(type, { bubbles: true, key: value, repeat }),
      ),
    );
  const tick = () => {
    expect(sdk.enabled).toBe(true);
    act(() => sdk.tick!());
    return sdk.write.mock.lastCall?.[0];
  };
  const neutral = { movementX: 0, movementY: 0, action: false };

  it("keeps pad ownership and allows drag through center; foreign releases cannot steal it", () => {
    pointer(pad(), "pointerdown");
    expect(tick()).toEqual({ ...neutral, movementX: 1 });
    pointer(pad(), "pointerdown", 2, 20, 120);
    pointer(pad(), "pointerup", 2);
    expect(tick()).toEqual({ ...neutral, movementX: 1 });
    pointer(pad(), "pointermove", 1, 150, 120);
    expect(tick()).toEqual(neutral);
    pointer(pad(), "pointermove", 1, 150, 20);
    expect(tick()).toEqual({ ...neutral, movementY: -1 });
    pointer(pad(), "pointerup");
    expect(tick()).toEqual(neutral);
  });

  it.each(["pointercancel", "lostpointercapture"])(
    "ends owned pad and WORK on %s",
    (event) => {
      pointer(pad(), "pointerdown", 1);
      pointer(work(), "pointerdown", 2);
      expect(tick()).toEqual({ movementX: 1, movementY: 0, action: true });
      pointer(pad(), event, 1);
      pointer(work(), event, 2);
      expect(tick()).toEqual(neutral);
    },
  );

  it.each(["blur", "hidden"])(
    "immediately publishes neutral on %s and ignores stale held gestures",
    (event) => {
      pointer(pad(), "pointerdown", 1);
      pointer(work(), "pointerdown", 2);
      if (event === "blur") act(() => window.dispatchEvent(new Event("blur")));
      else {
        vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        act(() => document.dispatchEvent(new Event("visibilitychange")));
      }
      expect(sdk.write).toHaveBeenLastCalledWith(neutral);
      expect(container.querySelector("output")!.textContent).toBe(
        '{"x":0,"y":0}',
      );
      pointer(pad(), "pointermove", 1);
      key("keydown", "Enter", true);
      expect(tick()).toEqual(neutral);
    },
  );

  it.each([
    { enabled: false },
    { lifecycleVersion: 2 },
    { controllerId: "replacement" },
    { connected: false },
  ])("clears held input for lifecycle change %j", (change) => {
    pointer(pad(), "pointerdown");
    pointer(work(), "pointerdown", 2);
    render(change);
    render();
    expect(tick()).toEqual(neutral);
    pointer(pad(), "pointermove");
    expect(tick()).toEqual(neutral);
    pointer(pad(), "pointerdown");
    expect(tick()).toEqual({ ...neutral, movementX: 1 });
  });

  it("clears immediately on unmount", () => {
    pointer(pad(), "pointerdown");
    act(() => root.render(null));
    expect(sdk.write).toHaveBeenLastCalledWith(neutral);
  });

  it("does not attempt a neutral write after the realtime client disconnects", () => {
    pointer(pad(), "pointerdown");
    sdk.write.mockClear();
    render({ connected: false });
    expect(sdk.write).not.toHaveBeenCalled();
  });

  it("supports keyboard WORK hold/release, focus loss, and independent pointer ownership", () => {
    key("keydown", " ");
    expect(tick()).toEqual({ ...neutral, action: true });
    key("keyup", " ");
    expect(tick()).toEqual(neutral);
    key("keydown", "Enter");
    act(() =>
      work().dispatchEvent(new FocusEvent("focusout", { bubbles: true })),
    );
    expect(tick()).toEqual(neutral);
    pointer(work(), "pointerdown", 2);
    pointer(work(), "pointerdown", 3);
    pointer(work(), "pointerup", 3);
    expect(tick()).toEqual({ ...neutral, action: true });
    pointer(work(), "pointerup", 2);
    expect(tick()).toEqual(neutral);
  });

  it("suppresses movement while busy without changing WORK or the game payload", () => {
    pointer(pad(), "pointerdown");
    pointer(work(), "pointerdown", 2);
    render({ busy: true });
    expect(tick()).toEqual({ ...neutral, action: true });
  });
});
