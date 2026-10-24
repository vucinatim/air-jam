import { z } from "zod";

/** A held button is true while down; a pressed button is true for one step per press. */
export type AirJamButtonMode = "held" | "pressed";

// A type alias, so values stay assignable to JSON records.
export type AirJamVector = {
  x: number;
  y: number;
};

export interface AirJamButtonControl<TName extends string = string> {
  readonly kind: "button";
  readonly name: TName;
  readonly mode: AirJamButtonMode;
}
export interface AirJamAxisControl<TName extends string = string> {
  readonly kind: "axis";
  readonly name: TName;
}
export interface AirJamStickControl<TName extends string = string> {
  readonly kind: "stick";
  readonly name: TName;
  /** Keeps the last direction while the stick is centred, as in snake. */
  readonly keepDirection: boolean;
}
export type AirJamControl<TName extends string = string> =
  | AirJamButtonControl<TName>
  | AirJamAxisControl<TName>
  | AirJamStickControl<TName>;

type ControlSpec = Omit<AirJamControl, "name">;
type Named<TSpecs extends Record<string, ControlSpec>> = {
  readonly [K in keyof TSpecs & string]: TSpecs[K] & { readonly name: K };
};

/** A game's declared controls by name, such as `shipInput.fire`. */
export type AirJamInput = Readonly<Record<string, AirJamControl>>;

type ControlValue<TControl> = TControl extends AirJamButtonControl
  ? boolean
  : TControl extends AirJamAxisControl
    ? number
    : AirJamVector;

/** What a simulation step reads for one player. */
export type AirJamInputValues<TInput extends AirJamInput> = {
  readonly [K in keyof TInput]: ControlValue<TInput[K]>;
};

/**
 * A button: `"held"` reads true while it is down, `"pressed"` reads true for
 * exactly one simulation step per press. Presses travel as a counter, so a
 * tap between two packets or two steps is never lost or doubled.
 */
export const button = (mode: AirJamButtonMode) =>
  ({ kind: "button", mode }) as const;

/** One number from -1 to 1, such as a paddle's direction. */
export const axis = () => ({ kind: "axis" }) as const;

/** Two numbers from -1 to 1. */
export const stick = (options: { keepDirection?: boolean } = {}) =>
  ({ kind: "stick", keepDirection: options.keepDirection ?? false }) as const;

/**
 * Declares what a game reads from each player. Phone controls, agents and
 * replays fill these controls; the host applies each kind's meaning once per
 * simulation step.
 */
export const defineAirJamInput = <
  const TSpecs extends Record<string, ControlSpec>,
>(
  controls: TSpecs,
): Named<TSpecs> =>
  Object.freeze(
    Object.fromEntries(
      Object.entries(controls).map(([name, spec]) => [
        name,
        Object.freeze({ ...spec, name }),
      ]),
    ),
  ) as Named<TSpecs>;

/** A button's state as sources send it: whether it is down and how often it was pressed. */
export interface AirJamButtonState {
  down: boolean;
  presses: number;
}

/** One player's controls as a source reports them; what travels and is recorded. */
export type AirJamInputState = Record<
  string,
  AirJamButtonState | number | AirJamVector
>;

const unit = z.number().min(-1).max(1);
const vectorSchema = z.object({ x: unit, y: unit }).strict();
const buttonStateSchema = z
  .object({ down: z.boolean(), presses: z.number().int().nonnegative() })
  .strict();

const describeControl = (control: AirJamControl): string => {
  if (control.kind === "button")
    return control.mode === "held"
      ? "Button: true while held down."
      : "Button: set true to press; set false and true again to press again.";
  if (control.kind === "axis") return "Axis from -1 to 1.";
  return "Stick with x and y from -1 to 1; y is down, like screen space.";
};

/** Validates what sources send. Controls left out read as released or centred. */
export const createInputStateSchema = (input: AirJamInput) =>
  z
    .object(
      Object.fromEntries(
        Object.values(input).map((control) => [
          control.name,
          (control.kind === "button"
            ? buttonStateSchema
            : control.kind === "axis"
              ? unit
              : vectorSchema
          ).optional(),
        ]),
      ),
    )
    .strict();

/**
 * Validates what agents send: a button is a boolean, an axis a number and a
 * stick an `{ x, y }`. Controls left out read as released or centred.
 */
export const createAgentInputSchema = (input: AirJamInput) =>
  z
    .object(
      Object.fromEntries(
        Object.values(input).map((control) => [
          control.name,
          (control.kind === "button"
            ? z.boolean()
            : control.kind === "axis"
              ? unit
              : vectorSchema
          )
            .describe(describeControl(control))
            .optional(),
        ]),
      ),
    )
    .strict();

const neutralState = (control: AirJamControl) =>
  control.kind === "button"
    ? { down: false, presses: 0 }
    : control.kind === "axis"
      ? 0
      : { x: 0, y: 0 };

/** Every control present, with left-out controls released or centred. */
export const completeInputState = (
  input: AirJamInput,
  state: Partial<AirJamInputState>,
): AirJamInputState =>
  Object.fromEntries(
    Object.values(input).map((control) => [
      control.name,
      state[control.name] ?? neutralState(control),
    ]),
  );

/**
 * Turns an agent's values into source state: a button going from up to down
 * counts one press.
 */
export const agentValuesToInputState = (
  previous: AirJamInputState | null,
  values: Record<string, unknown>,
): AirJamInputState =>
  Object.fromEntries(
    Object.entries(values).map(([name, value]) => {
      if (typeof value !== "boolean") return [name, value];
      const before = previous?.[name] as AirJamButtonState | undefined;
      const presses = before?.presses ?? 0;
      return [
        name,
        {
          down: value,
          presses: value && !before?.down ? presses + 1 : presses,
        },
      ];
    }),
  ) as AirJamInputState;

export const neutralInputValues = (
  input: AirJamInput,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.values(input).map((control) => [
      control.name,
      control.kind === "button"
        ? false
        : control.kind === "axis"
          ? 0
          : { x: 0, y: 0 },
    ]),
  );
