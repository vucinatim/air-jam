// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayingControls } from "../../src/controller/components/playing-controls";

vi.mock("../../src/controller/hooks/use-code-review-controller-teams", () => ({
  useCodeReviewControllerTeams: () => ({ teamAccent: "#dc2626" }),
}));
vi.mock("@air-jam/sdk/ui", () => {
  const Control = ({
    control,
    value,
    ...props
  }: {
    control: { name: string };
    value?: number;
  }) => <button {...props} data-control={control.name} data-value={value} />;
  return { AxisButton: Control, ControlButton: Control };
});

describe("Code Review movement choice and action controls", () => {
  let root: Root;
  let container: HTMLDivElement;
  let props: ComponentProps<typeof PlayingControls>;
  const render = () => act(() => root.render(<PlayingControls {...props} />));
  const button = (label: string) =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find(
      (element) => element.textContent?.replace(/\s+/g, " ").trim() === label,
    )!;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    root = createRoot(container);
    props = {
      movementMode: "touch",
      motionStatus: "touch",
      onEnableTilt: vi.fn(async () => {}),
      onUseTouch: vi.fn(),
    };
    render();
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });
  it("starts with a full touch path and requests motion only on explicit choice", () => {
    expect(container.querySelectorAll('[aria-label^="Move "]')).toHaveLength(4);
    expect(props.onEnableTilt).not.toHaveBeenCalled();
    act(() => button("Enable tilt").click());
    expect(props.onEnableTilt).toHaveBeenCalledOnce();
  });
  it.each(["denied", "unavailable"] as const)(
    "keeps touch movement on motion %s",
    (status) => {
      props.motionStatus = status;
      render();
      expect(container.querySelectorAll('[aria-label^="Move "]')).toHaveLength(
        4,
      );
      expect(
        container.querySelector('[role="status"]')?.textContent?.toLowerCase(),
      ).toContain(status);
    },
  );
  it("lets players cancel a pending permission request and leave tilt mode", () => {
    props.motionStatus = "requesting";
    render();
    act(() => button("Use touch").click());
    expect(props.onUseTouch).toHaveBeenCalledOnce();
    props.motionStatus = "tilt";
    props.movementMode = "tilt";
    render();
    expect(container.querySelector('[aria-label="Movement"]')).toBeNull();
    act(() => button("Use touch").click());
    expect(props.onUseTouch).toHaveBeenCalledTimes(2);
  });
  it("binds each action button to its declared control", () => {
    expect(button("TapLeft").dataset.control).toBe("leftPunch");
    expect(button("TapRight").dataset.control).toBe("rightPunch");
    expect(button("HoldGuardBlock").dataset.control).toBe("defend");
  });
});
