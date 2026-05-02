import {
  agentActionInput,
  type AirJamAgentActionCustomOptions,
  type AnyAirJamAgentContract,
} from "@air-jam/sdk";
import {
  createAgentActionMetadata,
  defineAgentActionInput,
  describeAgentActionInputs,
  type AirJamAgentActionDescriptor,
  type AirJamAgentActionInputDefinition,
  type AirJamAgentActionMetadata,
  type AirJamAgentActionOptions,
  type AirJamAgentActionParseMeta,
  type AirJamAgentActionPayloadKind,
  type AirJamAgentActionPayloadMetadata,
} from "@air-jam/sdk/agent-tooling";
import type { VisualScenario, VisualScenarioPack } from "../visual/types.js";
import type { VisualHarnessBridgeSnapshot } from "./runtime-bridge.js";

type VisualHarnessActionParseMeta = AirJamAgentActionParseMeta;

export type VisualHarnessActionPayloadKind = AirJamAgentActionPayloadKind;

export type VisualHarnessActionPayloadMetadata =
  AirJamAgentActionPayloadMetadata;

export type VisualHarnessActionMetadata = AirJamAgentActionMetadata;

export type VisualHarnessActionDescriptor = AirJamAgentActionDescriptor;

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
  input: AirJamAgentActionInputDefinition<TPayload>;
  parse: (payload: unknown, meta: VisualHarnessActionParseMeta) => TPayload;
  run: VisualHarnessActionHandler<TContext, TPayload, TResult>;
  metadata: VisualHarnessActionMetadata;
};

export type VisualHarnessActionDefinitions<TContext> = Record<
  string,
  // Existential wildcard for heterogenous published harness actions.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VisualHarnessActionDefinition<TContext, any, any>
>;

export type VisualHarnessBridgeDefinition<
  TContext,
  TSnapshot extends VisualHarnessBridgeSnapshot,
  TActions extends VisualHarnessActionDefinitions<TContext>,
> = {
  selectSnapshot: (context: TContext) => TSnapshot;
  actions: TActions;
};

type VisualHarnessBridgeInput<
  TContext,
  TSnapshot extends VisualHarnessBridgeSnapshot,
  TActions extends VisualHarnessActionDefinitions<TContext>,
> = {
  selectSnapshot: (context: TContext) => TSnapshot;
  actions?: TActions;
};

export type AnyVisualHarnessBridgeDefinition = VisualHarnessBridgeDefinition<
  // Existential wildcard for arbitrary bridge context/snapshot/action shapes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  VisualHarnessBridgeSnapshot,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  VisualHarnessActionDefinitions<any>
>;

export type InferVisualHarnessBridgeContext<TBridge> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TBridge extends VisualHarnessBridgeDefinition<infer TContext, any, any>
    ? TContext
    : never;

export type InferVisualHarnessBridgeSnapshot<TBridge> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TBridge extends VisualHarnessBridgeDefinition<any, infer TSnapshot, any>
    ? TSnapshot
    : never;

export type InferVisualHarnessBridgeActions<TBridge> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TBridge extends VisualHarnessBridgeDefinition<any, any, infer TActions>
    ? TActions
    : never;

export type InferVisualHarnessActionPayload<TAction> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TAction extends VisualHarnessActionDefinition<any, infer TPayload, any>
    ? TPayload
    : never;

export type InferVisualHarnessActionResult<TAction> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TAction extends VisualHarnessActionDefinition<any, any, infer TResult>
    ? Awaited<TResult>
    : never;

type VisualHarnessActionInvoker<TAction> =
  TAction extends VisualHarnessActionDefinition<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

type VisualHarnessCustomParser<TPayload> = (
  payload: unknown,
  meta: VisualHarnessActionParseMeta,
) => TPayload;

const createActionDefinition = <TContext, TPayload, TResult>(
  input: AirJamAgentActionInputDefinition<TPayload>,
  run: VisualHarnessActionHandler<TContext, TPayload, TResult>,
): VisualHarnessActionDefinition<TContext, TPayload, TResult> => ({
  input,
  parse: (payload, meta) =>
    input.parse(payload, {
      ...meta,
      contractKind: meta.contractKind ?? "harness",
    }),
  run,
  metadata: input.metadata,
});

const createNoPayloadInput = (
  options?: AirJamAgentActionCustomOptions,
): AirJamAgentActionInputDefinition<void> =>
  defineAgentActionInput(
    () => undefined,
    createAgentActionMetadata(
      {
        kind: options?.payloadKind ?? "none",
        ...(options?.allowedValues
          ? { allowedValues: options.allowedValues }
          : {}),
      },
      options,
    ),
  );

const resolveNumberAction = <TContext, TResult>(
  optionsOrRun:
    | AirJamAgentActionOptions
    | VisualHarnessActionHandler<TContext, number, TResult>,
  maybeRun?: VisualHarnessActionHandler<TContext, number, TResult>,
): VisualHarnessActionDefinition<TContext, number, TResult> => {
  const input =
    typeof optionsOrRun === "function"
      ? agentActionInput.number()
      : agentActionInput.number(optionsOrRun);
  const run =
    typeof optionsOrRun === "function"
      ? optionsOrRun
      : (maybeRun as VisualHarnessActionHandler<TContext, number, TResult>);

  return createActionDefinition(input, run);
};

const resolveEnumAction = <
  TContext,
  const TValues extends readonly string[],
  TResult,
>(
  values: TValues,
  optionsOrRun:
    | AirJamAgentActionOptions
    | VisualHarnessActionHandler<TContext, TValues[number], TResult>,
  maybeRun?: VisualHarnessActionHandler<TContext, TValues[number], TResult>,
): VisualHarnessActionDefinition<TContext, TValues[number], TResult> => {
  const input =
    typeof optionsOrRun === "function"
      ? agentActionInput.enum(values)
      : agentActionInput.enum(values, optionsOrRun);
  const run =
    typeof optionsOrRun === "function"
      ? optionsOrRun
      : (maybeRun as VisualHarnessActionHandler<
          TContext,
          TValues[number],
          TResult
        >);

  return createActionDefinition(input, run);
};

function numberAction<TContext, TResult>(
  run: VisualHarnessActionHandler<TContext, number, TResult>,
): VisualHarnessActionDefinition<TContext, number, TResult>;
function numberAction<TContext, TResult>(
  options: AirJamAgentActionOptions,
  run: VisualHarnessActionHandler<TContext, number, TResult>,
): VisualHarnessActionDefinition<TContext, number, TResult>;
function numberAction<TContext, TResult>(
  optionsOrRun:
    | AirJamAgentActionOptions
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
  options: AirJamAgentActionOptions,
  run: VisualHarnessActionHandler<TContext, TValues[number], TResult>,
): VisualHarnessActionDefinition<TContext, TValues[number], TResult>;
function enumAction<TContext, const TValues extends readonly string[], TResult>(
  values: TValues,
  optionsOrRun:
    | AirJamAgentActionOptions
    | VisualHarnessActionHandler<TContext, TValues[number], TResult>,
  maybeRun?: VisualHarnessActionHandler<TContext, TValues[number], TResult>,
): VisualHarnessActionDefinition<TContext, TValues[number], TResult> {
  return resolveEnumAction(values, optionsOrRun, maybeRun);
}

function customAction<TContext, TResult>(
  run: (context: TContext) => TResult | Promise<TResult>,
): VisualHarnessActionDefinition<TContext, void, TResult>;
function customAction<TContext, TResult>(
  options: AirJamAgentActionCustomOptions,
  run: (context: TContext) => TResult | Promise<TResult>,
): VisualHarnessActionDefinition<TContext, void, TResult>;
function customAction<TContext, TPayload, TResult>(
  parse: VisualHarnessCustomParser<TPayload>,
  run: VisualHarnessActionHandler<TContext, TPayload, TResult>,
): VisualHarnessActionDefinition<TContext, TPayload, TResult>;
function customAction<TContext, TPayload, TResult>(
  options: AirJamAgentActionCustomOptions,
  parse: VisualHarnessCustomParser<TPayload>,
  run: VisualHarnessActionHandler<TContext, TPayload, TResult>,
): VisualHarnessActionDefinition<TContext, TPayload, TResult>;
function customAction<TContext, TPayload, TResult>(
  optionsOrParseOrRun:
    | AirJamAgentActionCustomOptions
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
      createNoPayloadInput(),
      (context) =>
        (
          optionsOrParseOrRun as (
            context: TContext,
          ) => TResult | Promise<TResult>
        )(context),
    );
  }

  if (
    typeof optionsOrParseOrRun === "object" &&
    optionsOrParseOrRun !== null &&
    typeof maybeParseOrRun === "function" &&
    !maybeRun
  ) {
    return createActionDefinition<TContext, void, TResult>(
      createNoPayloadInput(optionsOrParseOrRun),
      (context) =>
        (maybeParseOrRun as (context: TContext) => TResult | Promise<TResult>)(
          context,
        ),
    );
  }

  if (typeof optionsOrParseOrRun === "function" && maybeRun) {
    return createActionDefinition<TContext, TPayload, TResult>(
      agentActionInput.custom(
        optionsOrParseOrRun as VisualHarnessCustomParser<TPayload>,
      ),
      maybeRun,
    );
  }

  if (
    typeof optionsOrParseOrRun === "object" &&
    optionsOrParseOrRun !== null &&
    typeof maybeParseOrRun === "function" &&
    maybeRun
  ) {
    return createActionDefinition<TContext, TPayload, TResult>(
      agentActionInput.custom(
        optionsOrParseOrRun,
        maybeParseOrRun as VisualHarnessCustomParser<TPayload>,
      ),
      maybeRun,
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
  bridge: VisualHarnessBridgeInput<TContext, TSnapshot, TActions>,
): VisualHarnessBridgeDefinition<TContext, TSnapshot, TActions> => ({
  selectSnapshot: bridge.selectSnapshot,
  actions: (bridge.actions ?? {}) as TActions,
});

export const defineVisualHarness = <
  TAgent extends AnyAirJamAgentContract,
  TBridge extends AnyVisualHarnessBridgeDefinition | null,
>(pack: {
  agent: TAgent;
  bridge?: TBridge;
  scenarios: ReadonlyArray<VisualScenario<TAgent, TBridge>>;
}): VisualScenarioPack<TAgent, TBridge> => pack;

export const describeVisualHarnessActions = <
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TActions extends VisualHarnessActionDefinitions<any>,
>(
  actions: TActions,
): VisualHarnessActionDescriptor[] => describeAgentActionInputs(actions);
