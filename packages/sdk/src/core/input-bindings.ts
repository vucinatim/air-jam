import type {
  AirJamAxisControl,
  AirJamButtonControl,
  AirJamControl,
  AirJamInput,
} from "./input";

/** A `KeyboardEvent.code`, such as `"KeyW"`, `"ArrowUp"` or `"Space"`. */
export type AirJamKeyCode = string;
type OneOrMore<T> = T | readonly T[];

/** Two key groups pulling an axis to -1 and to 1. */
export interface AirJamKeyAxisBinding {
  readonly kind: "keys-axis";
  readonly negative: readonly AirJamKeyCode[];
  readonly positive: readonly AirJamKeyCode[];
}
/** Four key groups steering a stick; y grows downwards, like the stick. */
export interface AirJamKeyStickBinding {
  readonly kind: "keys-stick";
  readonly up: readonly AirJamKeyCode[];
  readonly left: readonly AirJamKeyCode[];
  readonly down: readonly AirJamKeyCode[];
  readonly right: readonly AirJamKeyCode[];
}

const list = (keys: OneOrMore<AirJamKeyCode>): readonly AirJamKeyCode[] =>
  typeof keys === "string" ? [keys] : keys;

/** An axis from two keys or key groups: `keyAxis("KeyW", "KeyS")`. */
export const keyAxis = (
  negative: OneOrMore<AirJamKeyCode>,
  positive: OneOrMore<AirJamKeyCode>,
): AirJamKeyAxisBinding => ({
  kind: "keys-axis",
  negative: list(negative),
  positive: list(positive),
});
/** A stick from four keys or key groups. */
export const keyStick = (directions: {
  up: OneOrMore<AirJamKeyCode>;
  left: OneOrMore<AirJamKeyCode>;
  down: OneOrMore<AirJamKeyCode>;
  right: OneOrMore<AirJamKeyCode>;
}): AirJamKeyStickBinding => ({
  kind: "keys-stick",
  up: list(directions.up),
  left: list(directions.left),
  down: list(directions.down),
  right: list(directions.right),
});
export const wasd = () =>
  keyStick({ up: "KeyW", left: "KeyA", down: "KeyS", right: "KeyD" });
export const arrows = () =>
  keyStick({
    up: "ArrowUp",
    left: "ArrowLeft",
    down: "ArrowDown",
    right: "ArrowRight",
  });

/** Button indices of the W3C standard gamepad layout. */
export const gamepadButtons = {
  south: 0,
  east: 1,
  west: 2,
  north: 3,
  leftBumper: 4,
  rightBumper: 5,
  leftTrigger: 6,
  rightTrigger: 7,
  select: 8,
  start: 9,
  leftStickPress: 10,
  rightStickPress: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;
/** Axis indices of the W3C standard gamepad layout; y grows downwards. */
export const gamepadAxes = {
  leftStickX: 0,
  leftStickY: 1,
  rightStickX: 2,
  rightStickY: 3,
} as const;
export const gamepadSticks = ["leftStick", "rightStick", "dpad"] as const;
export type AirJamGamepadButton = keyof typeof gamepadButtons;
export type AirJamGamepadAxis = keyof typeof gamepadAxes;
export type AirJamGamepadStick = (typeof gamepadSticks)[number];

type KeyboardBindingFor<TControl> = TControl extends AirJamButtonControl
  ? OneOrMore<AirJamKeyCode>
  : TControl extends AirJamAxisControl
    ? AirJamKeyAxisBinding
    : AirJamKeyStickBinding;
type GamepadBindingFor<TControl> = TControl extends AirJamButtonControl
  ? OneOrMore<AirJamGamepadButton>
  : TControl extends AirJamAxisControl
    ? AirJamGamepadAxis
    : AirJamGamepadStick;

/** One local player's keys: each control it drives and the keys that drive it. */
export type AirJamKeyboardLayout<TInput extends object = AirJamInput> = {
  readonly [K in keyof TInput]?: KeyboardBindingFor<TInput[K]>;
};
/** What every connected gamepad drives, by standard-layout name. */
export type AirJamGamepadMapping<TInput extends object = AirJamInput> = {
  readonly [K in keyof TInput]?: GamepadBindingFor<TInput[K]>;
};
/**
 * How local players drive a game's controls without a phone: each keyboard
 * layout is one player, and every connected gamepad is one more.
 */
export interface AirJamInputBindings<TInput extends object = AirJamInput> {
  readonly keyboard?: readonly AirJamKeyboardLayout<TInput>[];
  readonly gamepad?: AirJamGamepadMapping<TInput>;
}

const isKeyList = (value: unknown): value is OneOrMore<AirJamKeyCode> =>
  typeof value === "string" ||
  (Array.isArray(value) && value.every((key) => typeof key === "string"));
const isKind = (value: unknown, kind: string): boolean =>
  typeof value === "object" &&
  value !== null &&
  (value as { kind?: unknown }).kind === kind;

const keyboardFits = (control: AirJamControl, binding: unknown): boolean =>
  control.kind === "button"
    ? isKeyList(binding)
    : control.kind === "axis"
      ? isKind(binding, "keys-axis")
      : isKind(binding, "keys-stick");
const gamepadFits = (control: AirJamControl, binding: unknown): boolean => {
  if (control.kind === "axis")
    return typeof binding === "string" && binding in gamepadAxes;
  if (control.kind === "stick")
    return (gamepadSticks as readonly unknown[]).includes(binding);
  const names = typeof binding === "string" ? [binding] : binding;
  return (
    Array.isArray(names) &&
    names.every((name) => typeof name === "string" && name in gamepadButtons)
  );
};

/**
 * Declares how local players drive a game's controls without a phone: each
 * keyboard layout is one player, and every connected gamepad is one more.
 * Pass the result to `defineAirJamGame({ input, inputBindings })`. Fails fast
 * on a binding for an undeclared control or of the wrong kind.
 */
export const defineAirJamInputBindings = <TInput extends object>(
  input: TInput,
  bindings: AirJamInputBindings<TInput>,
): AirJamInputBindings<TInput> => {
  const controls = input as AirJamInput;
  const check = (
    source: string,
    layout: Readonly<Record<string, unknown>>,
    fits: (control: AirJamControl, binding: unknown) => boolean,
  ) => {
    for (const [name, binding] of Object.entries(layout)) {
      const control = controls[name];
      if (!control)
        throw new Error(
          `${source} binds "${name}", which is not a declared control.`,
        );
      if (!fits(control, binding))
        throw new Error(
          `${source} binding for "${name}" does not fit a ${control.kind} control.`,
        );
    }
  };
  bindings.keyboard?.forEach((layout, index) =>
    check(`Keyboard layout ${index + 1}`, layout, keyboardFits),
  );
  if (bindings.gamepad) check("Gamepad mapping", bindings.gamepad, gamepadFits);
  return bindings;
};
