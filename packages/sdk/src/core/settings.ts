import { z } from "zod";

const common = {
  live: z.boolean().default(false),
  description: z.string().min(1).optional(),
};
const numberSettingSchema = z
  .object({
    kind: z.literal("number"),
    default: z.number().finite(),
    min: z.number().finite(),
    max: z.number().finite(),
    step: z.number().finite().positive().optional(),
    ...common,
  })
  .strict();
const booleanSettingSchema = z
  .object({
    kind: z.literal("boolean"),
    default: z.boolean(),
    ...common,
  })
  .strict();
const choiceSettingSchema = z
  .object({
    kind: z.literal("choice"),
    options: z.array(z.string().min(1)).nonempty(),
    default: z.string(),
    ...common,
  })
  .strict();

export const airJamSettingSchema = z.discriminatedUnion("kind", [
  numberSettingSchema,
  booleanSettingSchema,
  choiceSettingSchema,
]);
type SettingDefinition = z.infer<typeof airJamSettingSchema>;
export type AirJamSettings = Readonly<
  Record<
    string,
    | Exclude<SettingDefinition, { kind: "choice" }>
    | (Omit<Extract<SettingDefinition, { kind: "choice" }>, "options"> & {
        readonly options: readonly string[];
      })
  >
>;
export const airJamSettingsValuesSchema = z.record(
  z.string(),
  z.union([z.number().finite(), z.boolean(), z.string()]),
);
export type SettingsValues = Readonly<
  z.infer<typeof airJamSettingsValuesSchema>
>;
export type AirJamSettingsValues<TSettings extends AirJamSettings> = {
  readonly [Key in keyof TSettings]: TSettings[Key] extends { kind: "number" }
    ? number
    : TSettings[Key] extends { kind: "boolean" }
      ? boolean
      : TSettings[Key] extends { options: readonly (infer Choice)[] }
        ? Choice
        : never;
};

export const setting = {
  number: (options: Omit<z.input<typeof numberSettingSchema>, "kind">) =>
    ({ ...options, kind: "number" }) as const,
  boolean: (options: Omit<z.input<typeof booleanSettingSchema>, "kind">) =>
    ({ ...options, kind: "boolean" }) as const,
  choice: <const Choices extends readonly [string, ...string[]]>(options: {
    options: Choices;
    default: Choices[number];
    live?: boolean;
    description?: string;
  }) => ({ ...options, kind: "choice" }) as const,
};

type SettingDeclaration =
  | ReturnType<typeof setting.number>
  | ReturnType<typeof setting.boolean>
  | ReturnType<typeof setting.choice>;

function validValue(
  definition: AirJamSettings[string],
  value: unknown,
): boolean {
  if (definition.kind === "boolean") return typeof value === "boolean";
  if (definition.kind === "choice")
    return typeof value === "string" && definition.options.includes(value);
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < definition.min ||
    value > definition.max
  )
    return false;
  if (definition.step === undefined) return true;
  const steps = value / definition.step;
  return Math.abs(steps - Math.round(steps)) <= 1e-8;
}

export function defineAirJamSettings<
  const Declaration extends Record<string, SettingDeclaration>,
>(
  declaration: Declaration,
): {
  readonly [Key in keyof Declaration]: Declaration[Key] & {
    readonly live: boolean;
  };
} {
  const definitions = Object.fromEntries(
    Object.entries(declaration).map(([name, input]) => {
      if (!/^[a-z][a-zA-Z0-9]*$/.test(name))
        throw new Error(
          `AJ_SETTING_INVALID: ${name} must be a lower camel case id.`,
        );
      const definition = airJamSettingSchema.parse(input);
      if (!validValue(definition, definition.default))
        throw new Error(
          `AJ_SETTING_INVALID: ${name} needs a default in its range and on its step, or among its options.`,
        );
      if (definition.kind === "choice") Object.freeze(definition.options);
      return [name, Object.freeze(definition)];
    }),
  );
  return Object.freeze(definitions) as {
    readonly [Key in keyof Declaration]: Declaration[Key] & {
      readonly live: boolean;
    };
  };
}

/** One host owns these values. Every successful patch replaces one immutable snapshot. */
export class HostSettings {
  readonly initial: SettingsValues;
  private snapshot: { values: SettingsValues; revision: number };
  private readonly listeners = new Set<() => void>();

  constructor(
    readonly declaration: AirJamSettings = {},
    initial: SettingsValues = {},
  ) {
    this.validate(initial, false);
    this.initial = Object.freeze({
      ...Object.fromEntries(
        Object.entries(declaration).map(([name, definition]) => [
          name,
          definition.default,
        ]),
      ),
      ...initial,
    });
    this.snapshot = Object.freeze({ values: this.initial, revision: 0 });
  }

  readonly read = () => this.snapshot;
  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  update(
    patch: SettingsValues,
    expectedRevision: number,
    accepted: (revision: number) => void,
  ) {
    if (expectedRevision !== this.snapshot.revision)
      throw new Error(
        "AJ_SETTING_STALE: Read the current settings revision before updating.",
      );
    this.validate(patch, true);
    this.snapshot = Object.freeze({
      values: Object.freeze({ ...this.snapshot.values, ...patch }),
      revision: expectedRevision + 1,
    });
    accepted(this.snapshot.revision);
    for (const listener of this.listeners) listener();
    return this.snapshot;
  }

  private validate(patch: SettingsValues, live: boolean) {
    for (const [name, value] of Object.entries(patch)) {
      const definition = Object.hasOwn(this.declaration, name)
        ? this.declaration[name]
        : undefined;
      if (!definition)
        throw new Error(
          `AJ_SETTING_UNKNOWN: ${name} is not declared by this game.`,
        );
      if (!validValue(definition, value))
        throw new Error(
          `AJ_SETTING_INVALID: ${name} must match its declared type, range and step or options.`,
        );
      if (live && !definition.live)
        throw new Error(
          `AJ_SETTING_NOT_LIVE: Start a new room with ${name} set to that value.`,
        );
    }
  }
}
