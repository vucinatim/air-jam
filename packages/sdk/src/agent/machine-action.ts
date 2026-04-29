import type { ZodType } from "zod";

export type AirJamMachineActionPayloadKind =
  | "none"
  | "boolean"
  | "number"
  | "string"
  | "enum"
  | "json";

export type AirJamMachineActionPayloadMetadata = {
  kind: AirJamMachineActionPayloadKind;
  description?: string;
  allowedValues?: string[];
};

export type AirJamMachineActionMetadata = {
  description?: string;
  payload: AirJamMachineActionPayloadMetadata;
  resultDescription?: string;
};

export type AirJamMachineActionDescriptor = {
  name: string;
  description: string | null;
  payload: {
    kind: AirJamMachineActionPayloadKind;
    description: string | null;
    allowedValues?: string[];
  };
  resultDescription: string | null;
};

export type AirJamMachineActionParseMeta = {
  gameId: string;
  actionName: string;
  contractKind?: string;
};

export type AirJamMachineActionInputDefinition<TPayload = unknown> = {
  parse: (payload: unknown, meta: AirJamMachineActionParseMeta) => TPayload;
  metadata: AirJamMachineActionMetadata;
};

export type InferAirJamMachineActionInputPayload<TInput> =
  TInput extends AirJamMachineActionInputDefinition<infer TPayload>
    ? TPayload
    : never;

export type AirJamMachineActionOptions = {
  description?: string;
  payloadDescription?: string;
  resultDescription?: string;
};

export type AirJamMachineActionCustomOptions = AirJamMachineActionOptions & {
  payloadKind?: AirJamMachineActionPayloadKind;
  allowedValues?: string[];
};

const createActionError = (
  meta: AirJamMachineActionParseMeta,
  message: string,
): Error =>
  new Error(
    `[${meta.contractKind ?? "action"}:${meta.gameId}.${meta.actionName}] ${message}`,
  );

export const createMachineActionMetadata = (
  payload: AirJamMachineActionPayloadMetadata,
  options?: AirJamMachineActionOptions,
): AirJamMachineActionMetadata => ({
  description: options?.description,
  payload: {
    ...payload,
    description: options?.payloadDescription ?? payload.description,
  },
  resultDescription: options?.resultDescription,
});

export const defineMachineActionInput = <TPayload>(
  parse: (payload: unknown, meta: AirJamMachineActionParseMeta) => TPayload,
  metadata: AirJamMachineActionMetadata,
): AirJamMachineActionInputDefinition<TPayload> => ({
  parse,
  metadata,
});

const parseFiniteNumber = (
  payload: unknown,
  meta: AirJamMachineActionParseMeta,
): number => {
  const nextValue =
    typeof payload === "number" && Number.isFinite(payload)
      ? payload
      : typeof payload === "string"
        ? Number(payload)
        : Number.NaN;

  if (!Number.isFinite(nextValue)) {
    throw createActionError(meta, "expected a finite number payload");
  }

  return nextValue;
};

const parseStringValue = (
  payload: unknown,
  meta: AirJamMachineActionParseMeta,
): string => {
  if (typeof payload !== "string") {
    throw createActionError(meta, "expected a string payload");
  }

  return payload;
};

const parseBooleanValue = (
  payload: unknown,
  meta: AirJamMachineActionParseMeta,
): boolean => {
  if (typeof payload === "boolean") {
    return payload;
  }

  if (payload === "true" || payload === "1") {
    return true;
  }

  if (payload === "false" || payload === "0") {
    return false;
  }

  throw createActionError(meta, "expected a boolean payload");
};

const parseEnumValue = <const TValues extends readonly string[]>(
  values: TValues,
  payload: unknown,
  meta: AirJamMachineActionParseMeta,
): TValues[number] => {
  if (typeof payload !== "string" || !values.includes(payload)) {
    throw createActionError(meta, `expected one of: ${values.join(", ")}`);
  }

  return payload as TValues[number];
};

type AirJamMachineActionCustomParser<TPayload> = (
  payload: unknown,
  meta: AirJamMachineActionParseMeta,
) => TPayload;

type AirJamMachineActionZodSchema<TPayload> = ZodType<TPayload>;

const noneInput = (
  options?: AirJamMachineActionOptions,
): AirJamMachineActionInputDefinition<void> =>
  defineMachineActionInput(
    () => undefined,
    createMachineActionMetadata({ kind: "none" }, options),
  );

const numberInput = (
  options?: AirJamMachineActionOptions,
): AirJamMachineActionInputDefinition<number> =>
  defineMachineActionInput(
    parseFiniteNumber,
    createMachineActionMetadata({ kind: "number" }, options),
  );

const stringInput = (
  options?: AirJamMachineActionOptions,
): AirJamMachineActionInputDefinition<string> =>
  defineMachineActionInput(
    parseStringValue,
    createMachineActionMetadata({ kind: "string" }, options),
  );

const booleanInput = (
  options?: AirJamMachineActionOptions,
): AirJamMachineActionInputDefinition<boolean> =>
  defineMachineActionInput(
    parseBooleanValue,
    createMachineActionMetadata({ kind: "boolean" }, options),
  );

const enumInput = <const TValues extends readonly string[]>(
  values: TValues,
  options?: AirJamMachineActionOptions,
): AirJamMachineActionInputDefinition<TValues[number]> =>
  defineMachineActionInput(
    (payload, meta) => parseEnumValue(values, payload, meta),
    createMachineActionMetadata(
      {
        kind: "enum",
        allowedValues: [...values],
      },
      options,
    ),
  );

const jsonInput = (
  options?: AirJamMachineActionOptions,
): AirJamMachineActionInputDefinition<unknown> =>
  defineMachineActionInput(
    (payload) => payload,
    createMachineActionMetadata({ kind: "json" }, options),
  );

function customInput<TPayload>(
  parse: AirJamMachineActionCustomParser<TPayload>,
): AirJamMachineActionInputDefinition<TPayload>;
function customInput<TPayload>(
  options: AirJamMachineActionCustomOptions,
  parse: AirJamMachineActionCustomParser<TPayload>,
): AirJamMachineActionInputDefinition<TPayload>;
function customInput<TPayload>(
  optionsOrParse:
    | AirJamMachineActionCustomOptions
    | AirJamMachineActionCustomParser<TPayload>,
  maybeParse?: AirJamMachineActionCustomParser<TPayload>,
): AirJamMachineActionInputDefinition<TPayload> {
  if (typeof optionsOrParse === "function") {
    return defineMachineActionInput(
      optionsOrParse,
      createMachineActionMetadata({ kind: "json" }),
    );
  }

  if (typeof maybeParse === "function") {
    return defineMachineActionInput(
      maybeParse,
      createMachineActionMetadata(
        {
          kind: optionsOrParse.payloadKind ?? "json",
          allowedValues: optionsOrParse.allowedValues,
        },
        optionsOrParse,
      ),
    );
  }

  throw new Error("Invalid machine action input definition.");
}

const zodInput = <TPayload>(
  schema: AirJamMachineActionZodSchema<TPayload>,
  options?: AirJamMachineActionOptions,
): AirJamMachineActionInputDefinition<TPayload> =>
  defineMachineActionInput(
    (payload, meta) => {
      const result = schema.safeParse(payload);
      if (result.success) {
        return result.data;
      }

      const firstIssue = result.error.issues[0];
      throw createActionError(
        meta,
        firstIssue?.message ?? "payload failed schema validation",
      );
    },
    createMachineActionMetadata({ kind: "json" }, options),
  );

export const machineActionInput = {
  none: noneInput,
  number: numberInput,
  string: stringInput,
  boolean: booleanInput,
  enum: enumInput,
  json: jsonInput,
  custom: customInput,
  zod: zodInput,
};

export const describeMachineActionInputs = <
  TActions extends Record<
    string,
    { metadata?: AirJamMachineActionMetadata | undefined }
  >,
>(
  actions: TActions,
): AirJamMachineActionDescriptor[] =>
  Object.entries(actions)
    .map(([name, definition]) => {
      const metadata = definition.metadata;
      return {
        name,
        description: metadata?.description ?? null,
        payload: {
          kind: metadata?.payload.kind ?? "json",
          description: metadata?.payload.description ?? null,
          ...(metadata?.payload.allowedValues
            ? {
                allowedValues: [...metadata.payload.allowedValues],
              }
            : {}),
        },
        resultDescription: metadata?.resultDescription ?? null,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
