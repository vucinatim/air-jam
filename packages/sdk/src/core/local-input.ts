import { z } from "zod";
import type { AirJamInput, AirJamVector } from "./input";
import {
  gamepadAxes,
  gamepadButtons,
  type AirJamGamepadMapping,
  type AirJamKeyAxisBinding,
  type AirJamKeyboardLayout,
  type AirJamKeyStickBinding,
} from "./input-bindings";

/** The part of a seat's `ControllerInput` a local source drives. */
export interface LocalInputTarget {
  /** Puts a button down until the returned release is called. */
  press(name: string): () => void;
  /** Holds an axis at a value until the returned release is called. */
  hold(name: string, value: number): () => void;
  set(name: string, value: number | AirJamVector): void;
  releaseAll(): void;
}

type KeyRole =
  | { control: string; kind: "button" }
  | { control: string; kind: "axis"; value: -1 | 1 }
  | {
      control: string;
      kind: "stick";
      direction: "up" | "left" | "down" | "right";
    };

/**
 * One keyboard layout as one player: key downs and ups become presses,
 * axis holds and stick directions on its seat. Repeated key events never
 * count as presses.
 */
export class KeyboardSource {
  private readonly roles = new Map<string, KeyRole[]>();
  private readonly releases = new Map<string, () => void>();
  private readonly stickKeys = new Map<string, Set<string>>();
  private readonly sticks = new Map<string, AirJamKeyStickBinding>();

  constructor(
    layout: AirJamKeyboardLayout,
    private readonly target: LocalInputTarget,
  ) {
    const bind = (key: string, role: KeyRole) =>
      this.roles.set(key, [...(this.roles.get(key) ?? []), role]);
    for (const [control, binding] of Object.entries(layout)) {
      if (typeof binding === "string" || Array.isArray(binding)) {
        for (const key of typeof binding === "string" ? [binding] : binding)
          bind(key, { control, kind: "button" });
      } else if ((binding as AirJamKeyAxisBinding).kind === "keys-axis") {
        const axis = binding as AirJamKeyAxisBinding;
        for (const key of axis.negative)
          bind(key, { control, kind: "axis", value: -1 });
        for (const key of axis.positive)
          bind(key, { control, kind: "axis", value: 1 });
      } else {
        const stick = binding as AirJamKeyStickBinding;
        this.sticks.set(control, stick);
        this.stickKeys.set(control, new Set());
        for (const direction of ["up", "left", "down", "right"] as const)
          for (const key of stick[direction])
            bind(key, { control, kind: "stick", direction });
      }
    }
  }

  /** Whether this layout uses the key, so the page can keep it from the browser. */
  handles(code: string): boolean {
    return this.roles.has(code);
  }

  keyDown(code: string, repeat: boolean): void {
    const roles = this.roles.get(code);
    if (!roles || repeat) return;
    for (const role of roles) {
      const id = `${code}:${role.control}`;
      if (this.releases.has(id) || this.stickKeys.get(role.control)?.has(code))
        continue;
      if (role.kind === "button")
        this.releases.set(id, this.target.press(role.control));
      else if (role.kind === "axis")
        this.releases.set(id, this.target.hold(role.control, role.value));
      else {
        this.stickKeys.get(role.control)?.add(code);
        this.steer(role.control);
      }
    }
  }

  keyUp(code: string): void {
    for (const role of this.roles.get(code) ?? []) {
      const id = `${code}:${role.control}`;
      const release = this.releases.get(id);
      if (release) {
        this.releases.delete(id);
        release();
      } else if (this.stickKeys.get(role.control)?.delete(code))
        this.steer(role.control);
    }
  }

  /** Lets go of everything, such as when the page loses focus. */
  release(): void {
    for (const release of this.releases.values()) release();
    this.releases.clear();
    for (const [control, held] of this.stickKeys)
      if (held.size > 0) {
        held.clear();
        this.steer(control);
      }
  }

  private steer(control: string): void {
    const binding = this.sticks.get(control);
    const held = this.stickKeys.get(control);
    if (!binding || !held) return;
    const down = (direction: "up" | "left" | "down" | "right") =>
      binding[direction].some((key) => held.has(key)) ? 1 : 0;
    const x = down("right") - down("left");
    const y = down("down") - down("up");
    const length = Math.hypot(x, y) || 1;
    this.target.set(control, { x: x / length, y: y / length });
  }
}

/** One polled gamepad, as the Gamepad API reports it. */
export interface GamepadSnapshot {
  buttons: readonly { pressed: boolean; value: number }[];
  axes: readonly number[];
}

const STICK_DEADZONE = 0.15;
const TRIGGER_THRESHOLD = 0.5;

/** Rescales past a radial deadzone so a stick starts at zero and still reaches one. */
const shapeStick = (x: number, y: number): AirJamVector => {
  const length = Math.hypot(x, y);
  if (length <= STICK_DEADZONE) return { x: 0, y: 0 };
  const scale =
    Math.min(1, (length - STICK_DEADZONE) / (1 - STICK_DEADZONE)) / length;
  return { x: x * scale, y: y * scale };
};
const shapeAxis = (value: number): number =>
  Math.abs(value) <= STICK_DEADZONE
    ? 0
    : (Math.sign(value) * (Math.abs(value) - STICK_DEADZONE)) /
      (1 - STICK_DEADZONE);

/**
 * One gamepad as one player: each polled snapshot becomes presses, axis
 * values and stick vectors on its seat, sent only when they change.
 */
export class GamepadSource {
  private readonly releases = new Map<string, () => void>();
  private readonly values = new Map<string, string>();

  constructor(
    private readonly mapping: AirJamGamepadMapping,
    private readonly input: AirJamInput,
    private readonly target: LocalInputTarget,
  ) {}

  update(snapshot: GamepadSnapshot): void {
    for (const control of Object.keys(this.mapping)) {
      const value = this.read(control, snapshot);
      if (typeof value === "boolean") {
        const release = this.releases.get(control);
        if (value && !release)
          this.releases.set(control, this.target.press(control));
        if (!value && release) {
          this.releases.delete(control);
          release();
        }
        continue;
      }
      // Controls start centred, so an untouched gamepad sends nothing.
      const key = JSON.stringify(value);
      const centred = JSON.stringify(
        typeof value === "number" ? 0 : { x: 0, y: 0 },
      );
      if ((this.values.get(control) ?? centred) === key) continue;
      this.values.set(control, key);
      this.target.set(control, value);
    }
  }

  release(): void {
    for (const release of this.releases.values()) release();
    this.releases.clear();
    this.values.clear();
    this.target.releaseAll();
  }

  private read(
    control: string,
    snapshot: GamepadSnapshot,
  ): boolean | number | AirJamVector {
    const binding = this.mapping[control];
    const kind = this.input[control]?.kind;
    const button = (name: keyof typeof gamepadButtons) => {
      const state = snapshot.buttons[gamepadButtons[name]];
      return !!state && (state.pressed || state.value >= TRIGGER_THRESHOLD);
    };
    if (kind === "button")
      return (
        typeof binding === "string" ? [binding] : (binding as string[])
      ).some((name) => button(name as keyof typeof gamepadButtons));
    if (kind === "axis")
      return shapeAxis(
        snapshot.axes[gamepadAxes[binding as keyof typeof gamepadAxes]] ?? 0,
      );
    if (binding === "dpad") {
      const x = Number(button("dpadRight")) - Number(button("dpadLeft"));
      const y = Number(button("dpadDown")) - Number(button("dpadUp"));
      const length = Math.hypot(x, y) || 1;
      return { x: x / length, y: y / length };
    }
    const [xAxis, yAxis] = binding === "rightStick" ? [2, 3] : [0, 1];
    return shapeStick(snapshot.axes[xAxis] ?? 0, snapshot.axes[yAxis] ?? 0);
  }
}

/** One change a local source makes to a seat, sent to the seat's phone. */
export const localInputOperationSchema = z.discriminatedUnion("op", [
  z
    .object({
      op: z.literal("press"),
      control: z.string(),
      hold: z.number().int(),
    })
    .strict(),
  z
    .object({
      op: z.literal("hold"),
      control: z.string(),
      value: z.number().min(-1).max(1),
      hold: z.number().int(),
    })
    .strict(),
  z.object({ op: z.literal("release"), hold: z.number().int() }).strict(),
  z
    .object({
      op: z.literal("set"),
      control: z.string(),
      value: z.union([
        z.number().min(-1).max(1),
        z
          .object({
            x: z.number().min(-1).max(1),
            y: z.number().min(-1).max(1),
          })
          .strict(),
      ]),
    })
    .strict(),
  z.object({ op: z.literal("release-all") }).strict(),
]);
export type LocalInputOperation = z.infer<typeof localInputOperationSchema>;

/** A seat's controls in another frame, driven by sending operations to it. */
export class RemoteInputTarget implements LocalInputTarget {
  private nextHold = 1;

  constructor(
    private readonly send: (operation: LocalInputOperation) => void,
  ) {}

  press(control: string): () => void {
    const hold = this.nextHold++;
    this.send({ op: "press", control, hold });
    return () => this.send({ op: "release", hold });
  }

  hold(control: string, value: number): () => void {
    const hold = this.nextHold++;
    this.send({ op: "hold", control, value, hold });
    return () => this.send({ op: "release", hold });
  }

  set(control: string, value: number | AirJamVector): void {
    this.send({ op: "set", control, value });
  }

  releaseAll(): void {
    this.send({ op: "release-all" });
  }
}

/** The phone side: applies a local source's operations to its own controls. */
export class LocalInputReceiver {
  private readonly holds = new Map<number, () => void>();

  constructor(private readonly target: LocalInputTarget) {}

  apply(operation: LocalInputOperation): void {
    if (operation.op === "press")
      this.holds.set(operation.hold, this.target.press(operation.control));
    else if (operation.op === "hold")
      this.holds.set(
        operation.hold,
        this.target.hold(operation.control, operation.value),
      );
    else if (operation.op === "release") {
      this.holds.get(operation.hold)?.();
      this.holds.delete(operation.hold);
    } else if (operation.op === "set")
      this.target.set(operation.control, operation.value);
    else {
      for (const release of this.holds.values()) release();
      this.holds.clear();
      this.target.releaseAll();
    }
  }
}
