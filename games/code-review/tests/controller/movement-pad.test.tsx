// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MovementPad } from "../../src/controller/components/movement-pad";

vi.mock("@air-jam/sdk/ui", () => ({
  AxisButton: ({
    control,
    value,
    ...props
  }: {
    control: { name: string };
    value: number;
  }) => <button {...props} data-control={control.name} data-value={value} />,
}));

describe("Code Review touch movement", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    root = createRoot(container);
    act(() => root.render(<MovementPad />));
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });
  it.each([
    ["up", "vertical", "-1"],
    ["down", "vertical", "1"],
    ["left", "horizontal", "-1"],
    ["right", "horizontal", "1"],
  ] as const)(
    "holds %s by button meaning, independent of screen rotation",
    (direction, control, value) => {
      const button = container.querySelector<HTMLButtonElement>(
        `[aria-label="Move ${direction}"]`,
      )!;
      expect(button.dataset).toMatchObject({ control, value });
    },
  );
});
