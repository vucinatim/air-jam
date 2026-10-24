import { describe, expect, it } from "vitest";
import { ControllerInput } from "../src/core/controller-input";
import {
  axis,
  button,
  defineAirJamInput,
  readInputBindings,
  stick,
} from "../src/core/input";
import { arrows, keys, wasd } from "../src/core/input-bindings";
import {
  GamepadSource,
  KeyboardSource,
  LocalInputReceiver,
  RemoteInputTarget,
  type GamepadSnapshot,
  type LocalInputOperation,
} from "../src/core/local-input";

const fighterInput = defineAirJamInput(
  {
    move: stick(),
    strike: button("held"),
    dodge: button("pressed"),
    turn: axis(),
  },
  {
    keyboard: [
      {
        move: wasd(),
        strike: ["KeyJ", "Digit1"],
        dodge: "Space",
        turn: keys("KeyQ", "KeyE"),
      },
      { move: arrows(), strike: "Enter" },
    ],
    gamepad: {
      move: "leftStick",
      strike: ["south", "rightTrigger"],
      dodge: "east",
      turn: "rightStickX",
    },
  },
);

/** A seat's real controls, reached through the same operations a phone receives. */
const seat = () => {
  const controls = new ControllerInput(fighterInput, {
    send: () => {},
    requestFrame: () => {},
  });
  const sent: LocalInputOperation[] = [];
  const receiver = new LocalInputReceiver(controls);
  const target = new RemoteInputTarget((operation) => {
    sent.push(operation);
    receiver.apply(operation);
  });
  return { controls, sent, target };
};
const pad = (
  overrides: { buttons?: Record<number, number>; axes?: number[] } = {},
): GamepadSnapshot => ({
  buttons: Array.from({ length: 17 }, (_, index) => {
    const value = overrides.buttons?.[index] ?? 0;
    return { pressed: value === 1, value };
  }),
  axes: overrides.axes ?? [0, 0, 0, 0],
});

describe("declared bindings", () => {
  it("keeps bindings out of the controls games iterate", () => {
    expect(Object.keys(fighterInput)).toEqual([
      "move",
      "strike",
      "dodge",
      "turn",
    ]);
    expect(readInputBindings(fighterInput)?.keyboard).toHaveLength(2);
  });
  it("fails fast on bindings for undeclared controls or the wrong kind", () => {
    expect(() =>
      defineAirJamInput(
        { fire: button("pressed") },
        { keyboard: [{ jump: "Space" } as never] },
      ),
    ).toThrow(/not a declared control/);
    expect(() =>
      defineAirJamInput(
        { move: stick() },
        { keyboard: [{ move: "KeyW" as never }] },
      ),
    ).toThrow(/does not fit a stick/);
    expect(() =>
      defineAirJamInput(
        { move: stick() },
        { gamepad: { move: "leftStickX" as never } },
      ),
    ).toThrow(/does not fit a stick/);
  });
});

describe("keyboard source", () => {
  it("presses once per key down and ignores repeats", () => {
    const { controls, target, sent } = seat();
    const keyboard = new KeyboardSource(
      readInputBindings(fighterInput)!.keyboard![0],
      target,
    );
    keyboard.keyDown("Space", false);
    keyboard.keyDown("Space", true);
    keyboard.keyDown("Space", true);
    expect(controls.isDown("dodge")).toBe(true);
    keyboard.keyUp("Space");
    keyboard.keyDown("Space", false);
    keyboard.keyUp("Space");
    expect(sent.filter((operation) => operation.op === "press")).toHaveLength(
      2,
    );
    expect(controls.isDown("dodge")).toBe(false);
  });
  it("holds a button while any of its keys is down", () => {
    const { controls, target } = seat();
    const keyboard = new KeyboardSource(
      readInputBindings(fighterInput)!.keyboard![0],
      target,
    );
    keyboard.keyDown("KeyJ", false);
    keyboard.keyDown("Digit1", false);
    keyboard.keyUp("KeyJ");
    expect(controls.isDown("strike")).toBe(true);
    keyboard.keyUp("Digit1");
    expect(controls.isDown("strike")).toBe(false);
  });
  it("steers a stick y down and keeps diagonals at unit length", () => {
    const { controls, target } = seat();
    const keyboard = new KeyboardSource(
      readInputBindings(fighterInput)!.keyboard![0],
      target,
    );
    keyboard.keyDown("KeyS", false);
    expect(controls.value("move")).toEqual({ x: 0, y: 1 });
    keyboard.keyDown("KeyD", false);
    expect(controls.value("move")).toEqual({ x: 0.71, y: 0.71 });
    keyboard.keyUp("KeyS");
    keyboard.keyUp("KeyD");
    expect(controls.value("move")).toEqual({ x: 0, y: 0 });
  });
  it("lets the latest key of an axis win and releases everything on focus loss", () => {
    const { controls, target } = seat();
    const keyboard = new KeyboardSource(
      readInputBindings(fighterInput)!.keyboard![0],
      target,
    );
    keyboard.keyDown("KeyQ", false);
    keyboard.keyDown("KeyE", false);
    expect(controls.value("turn")).toBe(1);
    keyboard.keyUp("KeyE");
    expect(controls.value("turn")).toBe(-1);
    keyboard.keyDown("KeyW", false);
    keyboard.keyDown("KeyJ", false);
    keyboard.release();
    expect(controls.value("turn")).toBe(0);
    expect(controls.value("move")).toEqual({ x: 0, y: 0 });
    expect(controls.isDown("strike")).toBe(false);
  });
  it("only handles its own layout's keys", () => {
    const [first, second] = readInputBindings(fighterInput)!.keyboard!;
    expect(new KeyboardSource(first, seat().target).handles("ArrowUp")).toBe(
      false,
    );
    expect(new KeyboardSource(second, seat().target).handles("ArrowUp")).toBe(
      true,
    );
  });
});

describe("gamepad source", () => {
  const source = () => {
    const parts = seat();
    return {
      ...parts,
      gamepad: new GamepadSource(
        readInputBindings(fighterInput)!.gamepad!,
        fighterInput,
        parts.target,
      ),
    };
  };
  it("sends nothing for an untouched gamepad or a stick inside its deadzone", () => {
    const { gamepad, sent } = source();
    gamepad.update(pad());
    gamepad.update(pad({ axes: [0.1, -0.1, 0.05, 0] }));
    expect(sent).toEqual([]);
  });
  it("passes sticks through y down, rescaled past the deadzone", () => {
    const { gamepad, controls } = source();
    gamepad.update(pad({ axes: [0, 1, 0, 0] }));
    expect(controls.value("move")).toEqual({ x: 0, y: 1 });
    gamepad.update(pad({ axes: [0.575, 0, 0, 0] }));
    expect(controls.value("move")).toEqual({ x: 0.5, y: 0 });
  });
  it("presses buttons on their edges and treats a squeezed trigger as pressed", () => {
    const { gamepad, controls, sent } = source();
    gamepad.update(pad({ buttons: { 1: 1 } }));
    gamepad.update(pad({ buttons: { 1: 1 } }));
    expect(sent.filter((operation) => operation.op === "press")).toHaveLength(
      1,
    );
    expect(controls.isDown("dodge")).toBe(true);
    gamepad.update(pad({ buttons: { 7: 0.8 } }));
    expect(controls.isDown("dodge")).toBe(false);
    expect(controls.isDown("strike")).toBe(true);
  });
  it("reads an axis from a stick's single direction", () => {
    const { gamepad, controls } = source();
    gamepad.update(pad({ axes: [0, 0, -1, 0] }));
    expect(controls.value("turn")).toBe(-1);
  });
});
