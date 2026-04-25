import type { VisualHarnessBridgeSnapshot } from "./runtime-bridge.js";

type VisualHarnessActionParseMeta = {
  gameId: string;
  actionName: string;
};

export type VisualHarnessActionPayloadKind =
  | "none"
  | "number"
  | "enum"
  | "json";

export type VisualHarnessActionPayloadMetadata = {
  kind: VisualHarnessActionPayloadKind;
  description?: string;
  allowedValues?: string[];
};

export type VisualHarnessActionMetadata = {
  description?: string;
  payload: VisualHarnessActionPayloadMetadata;
  resultDescription?: string;
};

export type VisualHarnessActionDescriptor = {
  name: string;
  description: string | null;
  payload: {
    kind: VisualHarnessActionPayloadKind;
    description: string | null;
    allowedValues?: string[];
  };
  resultDescription: string | null;
};

type VisualHarnessActionOptions = {
  description?: string;
  payloadDescription?: string;
  resultDescription?: string;
};

type VisualHarnessCustomActionOptions = VisualHarnessActionOptions & {
  payloadKind?: VisualHarnessActionPayloadKind;
  allowedValues?: string[];
};

export type VisualHarnessActionHandler<
  TContext,
  TPayload,
  TResult = unknown,
> = (context: TContext, payload: TPayload) => TResult | Promise<TResult>;

export type VisualHarnessActionDefinition<
  TContext,
  TPayload,
  TResult = unknown,
> = {
  parse: (payload: unknown, meta: VisualHarnessActionParseMeta) => TPayload;
  run: VisualHarnessActionHandler<TContext, TPayload, TResult>;
  metadata: VisualHarnessActionMetadata;
};

export type VisualHarnessActionDefinitions<TContext> = Record<
  string,
  VisualHarnessActionDefinition<TContext, any, any>
>;

export type VisualHarnessBridgeDefinition<
  TContext,
  TSnapshot extends VisualHarnessBridgeSnapshot,
  TActions extends VisualHarnessActionDefinitions<TContext>,
> = {
  gameId: string;
  selectSnapshot: (context: TContext) => TSnapshot;
  actions: TActions;
};

export type AnyVisualHarnessBridgeDefinition = VisualHarnessBridgeDefinition<
  any,
  VisualHarnessBridgeSnapshot,
  VisualHarnessActionDefinitions<any>
>;

export type InferVisualHarnessBridgeContext<TBridge> =
  TBridge extends VisualHarnessBridgeDefinition<infer TContext, any, any>
    ? TContext
    : never;

export type InferVisualHarnessBridgeSnapshot<TBridge> =
  TBridge extends VisualHarnessBridgeDefinition<any, infer TSnapshot, any>
    ? TSnapshot
    : never;

export type InferVisualHarnessBridgeActions<TBridge> =
  TBridge extends VisualHarnessBridgeDefinition<any, any, infer TActions>
    ? TActions
    : never;

export type InferVisualHarnessActionPayload<TAction> =
  TAction extends VisualHarnessActionDefinition<any, infer TPayload, any>
    ? TPayload
    : never;

export type InferVisualHarnessActionResult<TAction> =
  TAction extends VisualHarnessActionDefinition<any, any, infer TResult>
    ? Awaited<TResult>
    : never;

type VisualHarnessActionInvoker<TAction> =
  TAction extends VisualHarnessActionDefinition<
    any,
    infer TPayload,
    infer TResult
  >
    ? (
        ...args: [TPayload] extends [void] ? [] : [payload: TPayload]
      ) => Promise<Awaited<TResult>>
    : never;

export type VisualHarnessActionInvokerMap<TActions> = {
  [K in keyof TActions]: VisualHarnessActionInvoker<TActions[K]>;
};

const createActionError = (
  gameId: string,
  actionName: string,
  message: string,
): Error => {
  return new Error(`[harness:${gameId}.${actionName}] ${message}`);
};

const createActionDefinition = <TContext, TPayload, TResult>(
  parse: (payload: unknown, meta: VisualHarnessActionParseMeta) => TPayload,
  run: VisualHarnessActionHandler<TContext, TPayload, TResult>,
  metadata: VisualHarnessActionMetadata,
): VisualHarnessActionDefinition<TContext, TPayload, TResult> => ({
  parse,
  run,
  metadata,
});

const createActionMetadata = (
  payload: VisualHarnessActionPayloadMetadata,
  options?: VisualHarnessActionOptions,
): VisualHarnessActionMetadata => ({
  description: options?.description,
  payload: {
    ...payload,
    description: options?.payloadDescription,
  },
  resultDescription: options?.resultDescription,
});

const parseFiniteNumber = (
  payload: unknown,
  meta: VisualHarnessActionParseMeta,
): number => {
  const nextValue =
    typeof payload === "number" && Number.isFinite(payload)
      ? payload
      : typeof payload === "string"
        ? Number(payload)
        : Number.NaN;

  if (!Number.isFinite(nextValue)) {
    throw createActionError(
      meta.gameId,
      meta.actionName,
      "expected a finite number payload",
    );
  }

  return nextValue;
};

const parseEnumValue = <const TValues extends readonly string[]>(
  values: TValues,
  payload: unknown,
  meta: VisualHarnessActionParseMeta,
): TValues[number] => {
  if (typeof payload !== "string" || !values.includes(payload)) {
    throw createActionError(
      meta.gameId,
      meta.actionName,
      `expected one of: ${values.join(", ")}`,
    );
  }

  return payload as TValues[number];
};

type VisualHarnessCustomParser<TPayload> = (
  payload: unknown,
  meta: VisualHarnessActionParseMeta,
) => TPayload;

const resolveNumberAction = <TContext, TResult>(
  optionsOrRun:
    | VisualHarnessActionOptions
    | VisualHarnessActionHandler<TContext, number, TResult>,
  maybeRun?: VisualHarnessActionHandler<TContext, number, TResult>,
): VisualHarnessActionDefinition<TContext, number, TResult> => {
  const options = typeof optionsOrRun === "function" ? undefined : optionsOrRun;
  const run =
    typeof optionsOrRun === "function"
      ? optionsOrRun
      : (maybeRun as VisualHarnessActionHandler<TContext, number, TResult>);

  return createActionDefinition(
    parseFiniteNumber,
    run,
    createActionMetadata({ kind: "number" }, options),
  );
};

const resolveEnumAction = <
  TContext,
  const TValues extends readonly string[],
  TResult,
>(
  values: TValues,
  optionsOrRun:
    | VisualHarnessActionOptions
    | VisualHarnessActionHandler<TContext, TValues[number], TResult>,
  maybeRun?: VisualHarnessActionHandler<TContext, TValues[number], TResult>,
): VisualHarnessActionDefinition<TContext, TValues[number], TResult> => {
  const options = typeof optionsOrRun === "function" ? undefined : optionsOrRun;
  const run =
    typeof optionsOrRun === "function"
      ? optionsOrRun
      : (maybeRun as VisualHarnessActionHandler<
          TContext,
          TValues[number],
          TResult
        >);

  return createActionDefinition(
    (payload, meta) => parseEnumValue(values, payload, meta),
    run,
    createActionMetadata(
      {
        kind: "enum",
        allowedValues: [...values],
      },
      options,
    ),
  );
};

function numberAction<TContext, TResult>(
  run: VisualHarnessActionHandler<TContext, number, TResult>,
): VisualHarnessActionDefinition<TContext, number, TResult>;
function numberAction<TContext, TResult>(
  options: VisualHarnessActionOptions,
  run: VisualHarnessActionHandler<TContext, number, TResult>,
): VisualHarnessActionDefinition<TContext, number, TResult>;
function numberAction<TContext, TResult>(
  optionsOrRun:
    | VisualHarnessActionOptions
    | VisualHarnessActionHandler<TContext, number, TResult>,
  maybeRun?: VisualHarnessActionHandler<TContext, number, TResult>,
): VisualHarnessActionDefinition<TContext, number, TResult> {
  return resolveNumberAction(optionsOrRun, maybeRun);
}

function enumAction<TContext, const TValues extends readonly string[], TResult>(
  values: TValues,
  run: VisualHarnessActionHandler<TContext, TValues[number], TResult>,
): VisualHarnessActionDefinition<TContext, TValues[number], TResult>;
function enumAction<TContext, const TValues extends readonly string[], TResult>(
  values: TValues,
  options: VisualHarnessActionOptions,
  run: VisualHarnessActionHandler<TContext, TValues[number], TResult>,
): VisualHarnessActionDefinition<TContext, TValues[number], TResult>;
function enumAction<TContext, const TValues extends readonly string[], TResult>(
  values: TValues,
  optionsOrRun:
    | VisualHarnessActionOptions
    | VisualHarnessActionHandler<TContext, TValues[number], TResult>,
  maybeRun?: VisualHarnessActionHandler<TContext, TValues[number], TResult>,
): VisualHarnessActionDefinition<TContext, TValues[number], TResult> {
  return resolveEnumAction(values, optionsOrRun, maybeRun);
}

function customAction<TContext, TResult>(
  run: (context: TContext) => TResult | Promise<TResult>,
): VisualHarnessActionDefinition<TContext, void, TResult>;
function customAction<TContext, TResult>(
  options: VisualHarnessCustomActionOptions,
  run: (context: TContext) => TResult | Promise<TResult>,
): VisualHarnessActionDefinition<TContext, void, TResult>;
function customAction<TContext, TPayload, TResult>(
  parse: VisualHarnessCustomParser<TPayload>,
  run: VisualHarnessActionHandler<TContext, TPayload, TResult>,
): VisualHarnessActionDefinition<TContext, TPayload, TResult>;
function customAction<TContext, TPayload, TResult>(
  options: VisualHarnessCustomActionOptions,
  parse: VisualHarnessCustomParser<TPayload>,
  run: VisualHarnessActionHandler<TContext, TPayload, TResult>,
): VisualHarnessActionDefinition<TContext, TPayload, TResult>;
function customAction<TContext, TPayload, TResult>(
  optionsOrParseOrRun:
    | VisualHarnessCustomActionOptions
    | VisualHarnessCustomParser<TPayload>
    | ((context: TContext) => TResult | Promise<TResult>),
  maybeParseOrRun?:
    | VisualHarnessCustomParser<TPayload>
    | VisualHarnessActionHandler<TContext, TPayload, TResult>,
  maybeRun?: VisualHarnessActionHandler<TContext, TPayload, TResult>,
):
  | VisualHarnessActionDefinition<TContext, TPayload, TResult>
  | VisualHarnessActionDefinition<TContext, void, TResult> {
  if (typeof optionsOrParseOrRun === "function" && !maybeParseOrRun) {
    return createActionDefinition<TContext, void, TResult>(
      () => undefined,
      (context) =>
        (
          optionsOrParseOrRun as (
            context: TContext,
          ) => TResult | Promise<TResult>
        )(context),
      createActionMetadata({ kind: "none" }),
    );
  }

  if (
    typeof optionsOrParseOrRun === "object" &&
    optionsOrParseOrRun !== null &&
    typeof maybeParseOrRun === "function" &&
    !maybeRun
  ) {
    return createActionDefinition<TContext, void, TResult>(
      () => undefined,
      (context) =>
        (maybeParseOrRun as (context: TContext) => TResult | Promise<TResult>)(
          context,
        ),
      createActionMetadata(
        {
          kind: optionsOrParseOrRun.payloadKind ?? "none",
          allowedValues: optionsOrParseOrRun.allowedValues,
        },
        optionsOrParseOrRun,
      ),
    );
  }

  if (typeof optionsOrParseOrRun === "function" && maybeRun) {
    return createActionDefinition<TContext, TPayload, TResult>(
      optionsOrParseOrRun as VisualHarnessCustomParser<TPayload>,
      maybeRun,
      createActionMetadata({ kind: "json" }),
    );
  }

  if (
    typeof optionsOrParseOrRun === "object" &&
    optionsOrParseOrRun !== null &&
    typeof maybeParseOrRun === "function" &&
    maybeRun
  ) {
    return createActionDefinition<TContext, TPayload, TResult>(
      maybeParseOrRun as VisualHarnessCustomParser<TPayload>,
      maybeRun,
      createActionMetadata(
        {
          kind: optionsOrParseOrRun.payloadKind ?? "json",
          allowedValues: optionsOrParseOrRun.allowedValues,
        },
        optionsOrParseOrRun,
      ),
    );
  }

  throw new Error("Invalid harness action definition.");
}

export const bridgeAction = {
  number: numberAction,
  enum: enumAction,
  custom: customAction,
};

export const defineVisualHarnessBridge = <
  TContext,
  TSnapshot extends VisualHarnessBridgeSnapshot,
  const TActions extends VisualHarnessActionDefinitions<TContext>,
>(
  bridge: VisualHarnessBridgeDefinition<TContext, TSnapshot, TActions>,
): VisualHarnessBridgeDefinition<TContext, TSnapshot, TActions> => bridge;

export const defineVisualHarness = <
  TBridge extends AnyVisualHarnessBridgeDefinition,
  TScenario extends {
    id: string;
    run: (...args: any[]) => Promise<void>;
  },
  TPack extends {
    gameId: string;
    bridge: TBridge;
    scenarios: ReadonlyArray<TScenario>;
  },
>(
  pack: TPack,
): TPack => pack;

export const describeVisualHarnessActions = <
  TActions extends VisualHarnessActionDefinitions<any>,
>(
  actions: TActions,
): VisualHarnessActionDescriptor[] =>
  Object.entries(actions)
    .map(([name, definition]) => ({
      name,
      description: definition.metadata?.description ?? null,
      payload: {
        kind: definition.metadata?.payload.kind ?? "json",
        description: definition.metadata?.payload.description ?? null,
        ...(definition.metadata?.payload.allowedValues
          ? {
              allowedValues: [...definition.metadata.payload.allowedValues],
            }
          : {}),
      },
      resultDescription: definition.metadata?.resultDescription ?? null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
