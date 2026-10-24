// @vitest-environment jsdom
import { ControllerInput } from "@air-jam/sdk/core";
import { act, createElement, useLayoutEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCodeReviewMovement } from "../../src/controller/hooks/use-code-review-movement";
import { codeReviewInput } from "../../src/game/contracts/input";

const sdk = vi.hoisted(() => ({ input: null as unknown }));
vi.mock("@air-jam/sdk", () => ({
  useAirJamController: () => ({ input: sdk.input }),
}));

type Movement = ReturnType<typeof useCodeReviewMovement>;

describe("Code Review movement", () => {
  let root: Root | null;
  let container: HTMLDivElement;
  let movement: Movement;
  let controls: ControllerInput;

  function Probe({ enabled }: { enabled: boolean }) {
    const current = useCodeReviewMovement({ enabled });
    useLayoutEffect(() => {
      movement = current;
    });
    return null;
  }
  const render = (enabled = true) =>
    act(() => root!.render(createElement(Probe, { enabled })));
  const axes = () => ({
    horizontal: controls.value("horizontal"),
    vertical: controls.value("vertical"),
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
      await movement.enableTilt();
    });
  };

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("DeviceOrientationEvent", class {});
    vi.spyOn(document, "hasFocus").mockImplementation(() => true);
    controls = new ControllerInput(codeReviewInput, {
      send: () => {},
      requestFrame: () => {},
    });
    sdk.input = controls;
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
    expect(movement.movementMode).toBe("touch");
    expect(requestPermission).not.toHaveBeenCalled();
    expect(axes()).toEqual({ horizontal: 0, vertical: 0 });
  });

  it.each(["denied", "reject", "throw"])(
    "keeps touch after permission %s",
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
      expect(movement.motionStatus).toBe("denied");
      expect(movement.movementMode).toBe("touch");
    },
  );

  it("reports unavailable motion only when requested", async () => {
    vi.stubGlobal("DeviceOrientationEvent", undefined);
    render();
    expect(movement.motionStatus).toBe("touch");
    await enableTilt();
    expect(movement.motionStatus).toBe("unavailable");
  });

  it("drives the movement axes from opted-in tilt, smoothed, ignoring invalid samples", async () => {
    render();
    await enableTilt();
    expect(movement.motionStatus).toBe("tilt");
    orientation(25, 25);
    expect(axes()).toEqual({ horizontal: 0.25, vertical: -0.25 });
    orientation(25, 25);
    expect(axes()).toEqual({ horizontal: 0.31, vertical: -0.31 });
    for (const [beta, gamma] of [
      [null, 25],
      [25, null],
      [Infinity, 1],
      [1, NaN],
    ] as const)
      orientation(beta, gamma);
    expect(axes()).toEqual({ horizontal: 0.31, vertical: -0.31 });
    act(() => movement.useTouch());
    expect(axes()).toEqual({ horizontal: 0, vertical: 0 });
    orientation(25, 25);
    expect(axes()).toEqual({ horizontal: 0, vertical: 0 });
  });

  it("reads no sensor and centres the axes while disabled", async () => {
    render();
    await enableTilt();
    orientation(25, 25);
    render(false);
    expect(axes()).toEqual({ horizontal: 0, vertical: 0 });
    orientation(25, 25);
    expect(axes()).toEqual({ horizontal: 0, vertical: 0 });
  });
});
