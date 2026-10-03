// @vitest-environment jsdom
import { act, createElement, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCodeReviewControllerInput } from "../../src/controller/hooks/use-code-review-controller-input";

const sdk = vi.hoisted(() => ({
  write: vi.fn<(_: Record<string, number | boolean>) => boolean>(() => true),
  tick: undefined as (() => void) | undefined,
  tickEnabled: false,
}));
vi.mock("@air-jam/sdk", () => ({
  useInputWriter: () => sdk.write,
  useControllerTick: (tick: () => void, options: { enabled: boolean }) => {
    sdk.tick = tick;
    sdk.tickEnabled = options.enabled;
  },
}));

const neutral = {
  vertical: 0,
  horizontal: 0,
  leftPunch: false,
  rightPunch: false,
  defend: false,
};
type Controls = ReturnType<typeof useCodeReviewControllerInput>;

describe("Code Review controller input", () => {
  let root: Root | null;
  let container: HTMLDivElement;
  let controls: Controls;
  let focused: boolean;
  let hidden: boolean;

  function Probe({ enabled }: { enabled: boolean }) {
    const current = useCodeReviewControllerInput({ enabled });
    useLayoutEffect(() => {
      controls = current;
    });
    return null;
  }
  const render = (enabled = true) =>
    act(() => root!.render(createElement(Probe, { enabled })));
  const tick = () =>
    act(() => {
      if (sdk.tickEnabled) sdk.tick?.();
    });
  const orientation = (beta: number | null, gamma: number | null) => {
    act(() => {
      const event = new Event("deviceorientation");
      Object.defineProperties(event, {
        beta: { value: beta },
        gamma: { value: gamma },
      });
      window.dispatchEvent(event);
    });
  };
  const enableTilt = async () => {
    await act(async () => {
      await controls.enableTilt();
    });
  };

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("DeviceOrientationEvent", class {});
    focused = true;
    hidden = false;
    vi.spyOn(document, "hasFocus").mockImplementation(() => focused);
    vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
    sdk.write.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root?.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("defaults to touch without requesting permission or reading motion", () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    vi.stubGlobal("DeviceOrientationEvent", { requestPermission });
    render();
    orientation(25, 25);
    tick();
    expect(controls.motionStatus).toBe("touch");
    expect(controls.movementMode).toBe("touch");
    expect(requestPermission).not.toHaveBeenCalled();
    expect(sdk.write).toHaveBeenLastCalledWith(neutral);
    act(() => controls.move({ x: 0.7, y: -0.4 }));
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith({
      ...neutral,
      horizontal: 0.7,
      vertical: -0.4,
    });
  });

  it.each(["denied", "reject", "throw"])(
    "keeps touch usable after permission %s",
    async (outcome) => {
      const requestPermission = vi.fn(() => {
        if (outcome === "throw") throw new Error("permission API failed");
        return outcome === "reject"
          ? Promise.reject(new Error("denied"))
          : Promise.resolve("denied");
      });
      vi.stubGlobal("DeviceOrientationEvent", { requestPermission });
      render();
      await enableTilt();
      expect(requestPermission).toHaveBeenCalledOnce();
      expect(controls.motionStatus).toBe("denied");
      expect(controls.movementMode).toBe("touch");
      act(() => controls.move({ x: 1, y: 0 }));
      tick();
      expect(sdk.write).toHaveBeenLastCalledWith({ ...neutral, horizontal: 1 });
    },
  );

  it("reports unavailable motion only when requested", async () => {
    vi.stubGlobal("DeviceOrientationEvent", undefined);
    render();
    expect(controls.motionStatus).toBe("touch");
    await enableTilt();
    expect(controls.motionStatus).toBe("unavailable");
    expect(controls.movementMode).toBe("touch");
  });

  it.each(["touch", "unmount"])(
    "ignores delayed permission after %s",
    async (cancel) => {
      let grant!: (permission: string) => void;
      const requestPermission = vi.fn(
        () =>
          new Promise<string>((resolve) => {
            grant = resolve;
          }),
      );
      vi.stubGlobal("DeviceOrientationEvent", { requestPermission });
      render();
      let pending!: Promise<void>;
      act(() => {
        pending = controls.enableTilt();
      });
      expect(requestPermission).toHaveBeenCalledOnce();
      expect(controls.motionStatus).toBe("requesting");
      act(() => {
        if (cancel === "touch") controls.useTouch();
        else {
          root!.unmount();
          root = null;
        }
      });
      sdk.write.mockClear();
      await act(async () => {
        grant("granted");
        await pending;
      });
      orientation(25, 25);
      if (cancel === "touch") {
        expect(controls.motionStatus).toBe("touch");
        tick();
        expect(sdk.write).toHaveBeenLastCalledWith(neutral);
      } else {
        expect(sdk.write).not.toHaveBeenCalled();
      }
    },
  );

  it("maps opted-in tilt, smooths it, and ignores invalid sensor samples", async () => {
    render();
    await enableTilt();
    expect(controls.motionStatus).toBe("tilt");
    orientation(25, 25);
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith({
      ...neutral,
      horizontal: 0.25,
      vertical: -0.25,
    });
    orientation(25, 25);
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith({
      ...neutral,
      horizontal: 0.31,
      vertical: -0.31,
    });
    const invalid: [number | null, number | null][] = [
      [null, 25],
      [25, null],
      [Infinity, 1],
      [1, NaN],
    ];
    for (const [beta, gamma] of invalid) orientation(beta, gamma);
    act(() => controls.move({ x: -1, y: 1 }));
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith({
      ...neutral,
      horizontal: 0.31,
      vertical: -0.31,
    });
    act(() => controls.useTouch());
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith(neutral);
    orientation(25, 25);
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith(neutral);
  });

  it("clamps finite touch movement and sends punches once with independent cooldowns", () => {
    render();
    act(() => {
      controls.move({ x: 4, y: -2 });
      controls.triggerLeftPunch();
      controls.triggerRightPunch();
      controls.startDefending();
    });
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith({
      horizontal: 1,
      vertical: -1,
      leftPunch: true,
      rightPunch: true,
      defend: true,
    });
    act(() => {
      controls.triggerLeftPunch();
      controls.move({ x: NaN, y: 1 });
    });
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith({
      horizontal: 1,
      vertical: -1,
      leftPunch: false,
      rightPunch: false,
      defend: true,
    });
    act(() => {
      controls.move({ x: 0, y: 0 });
      controls.stopDefending();
    });
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith(neutral);
  });

  it.each(["blur", "hidden", "disabled"])(
    "immediately releases input on %s and never replays it on resume",
    async (interruption) => {
      render();
      await enableTilt();
      orientation(25, 25);
      act(() => {
        controls.triggerLeftPunch();
        controls.startDefending();
      });
      sdk.write.mockClear();
      if (interruption === "disabled") render(false);
      else
        act(() => {
          if (interruption === "blur") {
            focused = false;
            window.dispatchEvent(new Event("blur"));
          } else {
            hidden = true;
            document.dispatchEvent(new Event("visibilitychange"));
          }
        });
      expect(sdk.write).toHaveBeenLastCalledWith(neutral);
      sdk.write.mockClear();
      orientation(25, 25);
      act(() => {
        controls.triggerRightPunch();
        controls.startDefending();
      });
      tick();
      expect(sdk.write).not.toHaveBeenCalled();
      if (interruption === "disabled") render();
      else
        act(() => {
          focused = true;
          hidden = false;
          window.dispatchEvent(new Event("focus"));
          document.dispatchEvent(new Event("visibilitychange"));
        });
      tick();
      expect(sdk.write).toHaveBeenLastCalledWith(neutral);
      orientation(25, 25);
      tick();
      expect(sdk.write).toHaveBeenLastCalledWith({
        ...neutral,
        horizontal: 0.25,
        vertical: -0.25,
      });
      act(() => controls.triggerLeftPunch());
      tick();
      expect(sdk.write.mock.lastCall?.[0]).toMatchObject({
        leftPunch: false,
        defend: false,
      });
    },
  );

  it("does not activate a sensor while disabled, even after permission resolves", async () => {
    render(false);
    await enableTilt();
    orientation(25, 25);
    tick();
    expect(sdk.write).not.toHaveBeenCalled();
    render();
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith(neutral);
  });

  it("accepts the first touch on focus before React has committed focus state", () => {
    focused = false;
    render();
    act(() => {
      focused = true;
      window.dispatchEvent(new Event("focus"));
      controls.move({ x: 1, y: -1 });
      controls.triggerLeftPunch();
      controls.startDefending();
    });
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith({
      horizontal: 1,
      vertical: -1,
      leftPunch: true,
      rightPunch: false,
      defend: true,
    });
  });

  it("cannot bypass punch cooldown by switching movement modes", async () => {
    render();
    act(() => controls.triggerLeftPunch());
    tick();
    await enableTilt();
    act(() => {
      controls.useTouch();
      controls.triggerLeftPunch();
    });
    tick();
    expect(sdk.write).toHaveBeenLastCalledWith(neutral);
  });

  it("neutralizes a held input when unmounted", () => {
    render();
    act(() => {
      controls.move({ x: 1, y: 1 });
      controls.startDefending();
    });
    tick();
    sdk.write.mockClear();
    act(() => {
      root!.unmount();
      root = null;
    });
    expect(sdk.write).toHaveBeenLastCalledWith(neutral);
  });
});
