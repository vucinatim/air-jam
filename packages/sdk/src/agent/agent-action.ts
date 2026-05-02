import type { ZodType } from "zod";

export type AirJamAgentActionPayloadKind =
  | "none"
  | "boolean"
  | "number"
  | "string"
  | "enum"
  | "json";

export type AirJamAgentActionPayloadMetadata = {
  kind: AirJamAgentActionPayloadKind;
  description?: string;
  allowedValues?: string[];
};

export type AirJamAgentActionMetadata = {
  description?: string;
  payload: AirJamAgentActionPayloadMetadata;
  resultDescription?: string;
};

export type AirJamAgentActionDescriptor = {
  name: string;
  description: string | null;
  payload: {
    kind: AirJamAgentActionPayloadKind;
    description: string | null;
    allowedValues?: string[];
  };
  resultDescription: string | null;
};

export type AirJamAgentActionParseMeta = {
  gameId: string;
  actionName: string;
  contractKind?: string;
};

export type AirJamAgentActionInputDefinition<TPayload = unknown> = {
  parse: (payload: unknown, meta: AirJamAgentActionParseMeta) => TPayload;
  metadata: AirJamAgentActionMetadata;
};

export type InferAirJamAgentActionInputPayload<TInput> =
  TInput extends AirJamAgentActionInputDefinition<infer TPayload>
    ? TPayload
    : never;

export type AirJamAgentActionOptions = {
  description?: string;
  payloadDescription?: string;
  resultDescription?: string;
};

export type AirJamAgentActionCustomOptions = AirJamAgentActionOptions & {
  payloadKind?: AirJamAgentActionPayloadKind;
  allowedValues?: string[];
};

const createActionError = (
  meta: AirJamAgentActionParseMeta,
  message: string,
): Error =>
  new Error(
    `[${meta.contractKind ?? "action"}:${meta.gameId}.${meta.actionName}] ${message}`,
  );

export const createAgentActionMetadata = (
  payload: AirJamAgentActionPayloadMetadata,
  options?: AirJamAgentActionOptions,
): AirJamAgentActionMetadata => ({
  description: options?.description,
  payload: {
    ...payload,
    description: options?.payloadDescription ?? payload.description,
  },
  resultDescription: options?.resultDescription,
});

export const defineAgentActionInput = <TPayload>(
  parse: (payload: unknown, meta: AirJamAgentActionParseMeta) => TPayload,
  metadata: AirJamAgentActionMetadata,
): AirJamAgentActionInputDefinition<TPayload> => ({
  parse,
  metadata,
});

const parseFiniteNumber = (
  payload: unknown,
  meta: AirJamAgentActionParseMeta,
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
  meta: AirJamAgentActionParseMeta,
): string => {
  if (typeof payload !== "string") {
    throw createActionError(meta, "expected a string payload");
  }

  return payload;
};

const parseBooleanValue = (
  payload: unknown,
  meta: AirJamAgentActionParseMeta,
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
  meta: AirJamAgentActionParseMeta,
): TValues[number] => {
  if (typeof payload !== "string" || !values.includes(payload)) {
    throw createActionError(meta, `expected one of: ${values.join(", ")}`);
  }

  return payload as TValues[number];
};

type AirJamAgentActionCustomParser<TPayload> = (
  payload: unknown,
  meta: AirJamAgentActionParseMeta,
) => TPayload;

type AirJamAgentActionZodSchema<TPayload> = ZodType<TPayload>;

const noneInput = (
  options?: AirJamAgentActionOptions,
): AirJamAgentActionInputDefinition<void> =>
  defineAgentActionInput(
    () => undefined,
    createAgentActionMetadata({ kind: "none" }, options),
  );

const numberInput = (
  options?: AirJamAgentActionOptions,
): AirJamAgentActionInputDefinition<number> =>
  defineAgentActionInput(
    parseFiniteNumber,
    createAgentActionMetadata({ kind: "number" }, options),
  );

const stringInput = (
  options?: AirJamAgentActionOptions,
): AirJamAgentActionInputDefinition<string> =>
  defineAgentActionInput(
    parseStringValue,
    createAgentActionMetadata({ kind: "string" }, options),
  );

const booleanInput = (
  options?: AirJamAgentActionOptions,
): AirJamAgentActionInputDefinition<boolean> =>
  defineAgentActionInput(
    parseBooleanValue,
    createAgentActionMetadata({ kind: "boolean" }, options),
  );

const enumInput = <const TValues extends readonly string[]>(
  values: TValues,
  options?: AirJamAgentActionOptions,
): AirJamAgentActionInputDefinition<TValues[number]> =>
  defineAgentActionInput(
    (payload, meta) => parseEnumValue(values, payload, meta),
    createAgentActionMetadata(
      {
        kind: "enum",
        allowedValues: [...values],
      },
      options,
    ),
  );

const jsonInput = (
  options?: AirJamAgentActionOptions,
): AirJamAgentActionInputDefinition<unknown> =>
  defineAgentActionInput(
    (payload) => payload,
    createAgentActionMetadata({ kind: "json" }, options),
  );

function customInput<TPayload>(
  parse: AirJamAgentActionCustomParser<TPayload>,
): AirJamAgentActionInputDefinition<TPayload>;
function customInput<TPayload>(
  options: AirJamAgentActionCustomOptions,
  parse: AirJamAgentActionCustomParser<TPayload>,
): AirJamAgentActionInputDefinition<TPayload>;
function customInput<TPayload>(
  optionsOrParse:
    | AirJamAgentActionCustomOptions
    | AirJamAgentActionCustomParser<TPayload>,
  maybeParse?: AirJamAgentActionCustomParser<TPayload>,
): AirJamAgentActionInputDefinition<TPayload> {
  if (typeof optionsOrParse === "function") {
    return defineAgentActionInput(
      optionsOrParse,
      createAgentActionMetadata({ kind: "json" }),
    );
  }

  if (typeof maybeParse === "function") {
    return defineAgentActionInput(
      maybeParse,
      createAgentActionMetadata(
        {
          kind: optionsOrParse.payloadKind ?? "json",
          allowedValues: optionsOrParse.allowedValues,
        },
        optionsOrParse,
      ),
    );
  }

  throw new Error("Invalid agent action input definition.");
}

const zodInput = <TPayload>(
  schema: AirJamAgentActionZodSchema<TPayload>,
  options?: AirJamAgentActionOptions,
): AirJamAgentActionInputDefinition<TPayload> =>
  defineAgentActionInput(
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
    createAgentActionMetadata({ kind: "json" }, options),
  );

export const agentActionInput = {
  none: noneInput,
  number: numberInput,
  string: stringInput,
  boolean: booleanInput,
  enum: enumInput,
  json: jsonInput,
  custom: customInput,
  zod: zodInput,
};

export const describeAgentActionInputs = <
  TActions extends Record<
    string,
    { metadata?: AirJamAgentActionMetadata | undefined }
  >,
>(
  actions: TActions,
): AirJamAgentActionDescriptor[] =>
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
