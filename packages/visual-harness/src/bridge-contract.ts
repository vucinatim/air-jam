import type { VisualHarnessBridgeSnapshot } from "./runtime-bridge.js";

type VisualHarnessActionParseMeta = {
  gameId: string;
  actionName: string;
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
  return new Error(`[visual-harness:${gameId}.${actionName}] ${message}`);
};

const createActionDefinition = <TContext, TPayload, TResult>(
  parse: (payload: unknown, meta: VisualHarnessActionParseMeta) => TPayload,
  run: VisualHarnessActionHandler<TContext, TPayload, TResult>,
): VisualHarnessActionDefinition<TContext, TPayload, TResult> => ({
  parse,
  run,
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

function customAction<TContext, TResult>(
  run: (context: TContext) => TResult | Promise<TResult>,
): VisualHarnessActionDefinition<TContext, void, TResult>;
function customAction<TContext, TPayload, TResult>(
  parse: VisualHarnessCustomParser<TPayload>,
  run: VisualHarnessActionHandler<TContext, TPayload, TResult>,
): VisualHarnessActionDefinition<TContext, TPayload, TResult>;
function customAction<TContext, TPayload, TResult>(
  parseOrRun:
    | VisualHarnessCustomParser<TPayload>
    | ((context: TContext) => TResult | Promise<TResult>),
  maybeRun?: VisualHarnessActionHandler<TContext, TPayload, TResult>,
):
  | VisualHarnessActionDefinition<TContext, TPayload, TResult>
  | VisualHarnessActionDefinition<TContext, void, TResult> {
  if (!maybeRun) {
    return createActionDefinition<TContext, void, TResult>(
      () => undefined,
      (context) =>
        (parseOrRun as (context: TContext) => TResult | Promise<TResult>)(
          context,
        ),
    );
  }

  return createActionDefinition<TContext, TPayload, TResult>(
    parseOrRun as VisualHarnessCustomParser<TPayload>,
    maybeRun,
  );
}

export const bridgeAction = {
  number: <TContext, TResult>(
    run: VisualHarnessActionHandler<TContext, number, TResult>,
  ): VisualHarnessActionDefinition<TContext, number, TResult> =>
    createActionDefinition(parseFiniteNumber, run),
  enum: <TContext, const TValues extends readonly string[], TResult>(
    values: TValues,
    run: VisualHarnessActionHandler<TContext, TValues[number], TResult>,
  ): VisualHarnessActionDefinition<TContext, TValues[number], TResult> =>
    createActionDefinition(
      (payload, meta) => parseEnumValue(values, payload, meta),
      run,
    ),
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
