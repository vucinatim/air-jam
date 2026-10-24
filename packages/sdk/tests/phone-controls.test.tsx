// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { AxisButton, ControlButton, Stick } from "../src/components/controls";
import { ControllerInput } from "../src/core/controller-input";
import { axis, button, defineAirJamInput, stick } from "../src/core/input";
import { controllerRuntimeContext } from "../src/runtime/runtime-owner-contexts";

const padInput = defineAirJamInput({
  paddle: axis(),
  fire: button("pressed"),
  move: stick(),
});

const renderControls = (children: ReactNode) => {
  const sent: unknown[] = [];
  const input = new ControllerInput(padInput, {
    send: (state) => sent.push(state),
    requestFrame: (callback) => callback(),
  });
  render(
    <controllerRuntimeContext.Provider value={{ input }}>
      {children}
    </controllerRuntimeContext.Provider>,
  );
  return { input, sent };
};

const pointer = { pointerId: 1, button: 0 };

describe("phone controls", () => {
  it("counts one press per touch and shows the held state", () => {
    const { input } = renderControls(
      <ControlButton control={padInput.fire}>Fire</ControlButton>,
    );
    const fire = screen.getByRole("button", { name: "Fire" });
    fireEvent.pointerDown(fire, pointer);
    expect(fire.dataset.active).toBe("true");
    expect(input.isDown("fire")).toBe(true);
    fireEvent.blur(fire);
    expect(input.isDown("fire")).toBe(true);
    fireEvent.pointerUp(fire, pointer);
    expect(fire.dataset.active).toBe("false");
    fireEvent.keyDown(fire, { key: " " });
    fireEvent.blur(fire);
    expect(input.isDown("fire")).toBe(false);
    expect(input.value("fire")).toEqual({ down: false, presses: 2 });
  });

  it("holds an axis while its button is held, the latest held button winning", () => {
    const { input } = renderControls(
      <>
        <AxisButton control={padInput.paddle} value={-1}>
          Up
        </AxisButton>
        <AxisButton control={padInput.paddle} value={1}>
          Down
        </AxisButton>
      </>,
    );
    const up = screen.getByRole("button", { name: "Up" });
    const down = screen.getByRole("button", { name: "Down" });
    fireEvent.pointerDown(up, pointer);
    fireEvent.pointerDown(down, { ...pointer, pointerId: 2 });
    expect(input.value("paddle")).toBe(1);
    fireEvent.pointerUp(down, { ...pointer, pointerId: 2 });
    expect(input.value("paddle")).toBe(-1);
    fireEvent.pointerCancel(up, pointer);
    expect(input.value("paddle")).toBe(0);
  });

  it("reads the stick in its own frame, however its surface is rotated", () => {
    const { input } = renderControls(
      <Stick control={padInput.move} data-testid="stick" />,
    );
    const area = screen.getByTestId("stick");
    const [origin, right, bottom] = Array.from(area.querySelectorAll("span"));
    const place = (element: Element, x: number, y: number) => {
      element.getBoundingClientRect = () =>
        ({ x, y, width: 0, height: 0 }) as DOMRect;
    };
    // The surface is turned a quarter: its top-left corner sits top-right on screen.
    place(origin, 100, 0);
    place(right, 100, 100);
    place(bottom, 0, 0);
    fireEvent.pointerDown(area, { ...pointer, clientX: 100, clientY: 50 });
    expect(input.value("move")).toEqual({ x: 0, y: -1 });
    fireEvent.pointerMove(area, { ...pointer, clientX: 50, clientY: 100 });
    expect(input.value("move")).toEqual({ x: 1, y: 0 });
    fireEvent.pointerUp(area, pointer);
    expect(input.value("move")).toEqual({ x: 0, y: 0 });
  });

  it("explains a control used where the game declares no controls", () => {
    expect(() =>
      render(
        <controllerRuntimeContext.Provider value={{ input: null }}>
          <ControlButton control={padInput.fire}>Fire</ControlButton>
        </controllerRuntimeContext.Provider>,
      ),
    ).toThrow(/createAirJamApp\(\{ input \}\)/);
  });
});
