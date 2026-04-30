import {
  type AirJamAgentActionInputDefinition,
  type AirJamAgentActionMetadata,
  type AirJamAgentActionParseMeta,
  type AirJamAgentActionPayloadKind,
  type AirJamAgentActionPayloadMetadata,
  type AirJamAgentActionOptions,
} from "./agent-action.js";

export type AirJamAgentJsonObject = Record<string, unknown>;

export type AirJamAgentContractPayloadKind = AirJamAgentActionPayloadKind;

export type AirJamAgentContractPayloadMetadata =
  AirJamAgentActionPayloadMetadata;

export type AirJamAgentStoreDeclaration<TStore extends object = object> = {
  readonly __store?: TStore;
};

export type AirJamAgentStoreDeclarations = Record<
  string,
  AirJamAgentStoreDeclaration<any>
>;

export type AirJamAgentActionTarget = {
  kind: "participant";
  actionName: string;
  storeDomain?: string;
};

export type AirJamAgentStores = Record<string, object>;

export type InferAirJamAgentStores<
  TDeclarations extends AirJamAgentStoreDeclarations,
> = {
  [TKey in keyof TDeclarations]: TDeclarations[TKey] extends AirJamAgentStoreDeclaration<
    infer TStore
  >
    ? TStore
    : never;
};

type AirJamAgentActionContractBase = {
  target: AirJamAgentActionTarget;
  description?: string;
  availability?: string;
  /**
   * Human and agent-facing description of the expected semantic effect.
   * This does not automatically become runtime result data; return
   * `acceptAirJamAction(result)` from the underlying store action when callers
   * need an actual result payload.
   */
  resultDescription?: string;
};

export type AirJamAgentResolvedActionContract<
  TInput = unknown,
  TPayload = TInput,
> = AirJamAgentActionContractBase & {
  input: AirJamAgentActionInputDefinition<TInput>;
  toPayload?: (input: TInput) => TPayload;
};

export type AirJamAgentActionContract =
  AirJamAgentResolvedActionContract<any, any>;

export type AirJamAgentContractActionOptions<TInput, TPayload = TInput> =
  AirJamAgentActionOptions & {
    availability?: string;
    input: AirJamAgentActionInputDefinition<TInput>;
    toPayload?: (input: TInput) => TPayload;
  };

export type AirJamAgentSnapshotContext<
  TStores extends AirJamAgentStores = AirJamAgentStores,
> = {
  controllerId: string | null;
  stores: Partial<TStores>;
};

export type AirJamAgentContract<
  TSnapshot extends AirJamAgentJsonObject = AirJamAgentJsonObject,
  TStoreDeclarations extends AirJamAgentStoreDeclarations = AirJamAgentStoreDeclarations,
> = {
  stores: TStoreDeclarations;
  snapshotDescription?: string;
  projectSnapshot: (
    context: AirJamAgentSnapshotContext<
      InferAirJamAgentStores<TStoreDeclarations>
    >,
  ) => TSnapshot | Promise<TSnapshot>;
  actions: Record<string, AirJamAgentActionContract>;
};

export const agentStore = <TStore extends object>(): AirJamAgentStoreDeclaration<TStore> =>
  ({}) as AirJamAgentStoreDeclaration<TStore>;

export const defineAirJamAgentStores = <
  TDeclarations extends AirJamAgentStoreDeclarations,
>(
  stores: TDeclarations,
): TDeclarations => stores;

export const listAirJamAgentStoreDomains = (
  contract: AirJamAgentContract<any, any>,
): string[] => Object.keys(contract.stores);

export const describeAirJamAgentAction = (
  action: AirJamAgentActionContract,
): AirJamAgentActionMetadata =>
  ({
    description: action.description ?? action.input.metadata.description,
    payload: {
      ...action.input.metadata.payload,
    },
    resultDescription:
      action.resultDescription ?? action.input.metadata.resultDescription,
  });

export const resolveAirJamAgentActionPayload = (
  action: AirJamAgentActionContract,
  payload: unknown,
  meta: AirJamAgentActionParseMeta,
): unknown => {
  const parsedInput = action.input.parse(payload, meta);
  return action.toPayload ? action.toPayload(parsedInput) : parsedInput;
};

export const agentAction = {
  participant: <TInput, TPayload = TInput>(
    target: Omit<AirJamAgentActionTarget, "kind">,
    options: AirJamAgentContractActionOptions<TInput, TPayload>,
  ): AirJamAgentResolvedActionContract<TInput, TPayload> => ({
    target: {
      kind: "participant",
      actionName: target.actionName,
      ...(target.storeDomain ? { storeDomain: target.storeDomain } : {}),
    },
    description: options.description,
    availability: options.availability,
    input: options.input,
    toPayload: options.toPayload,
    resultDescription: options.resultDescription,
  }),
};

export const defineAirJamAgentContract = <
  TSnapshot extends AirJamAgentJsonObject,
  TStoreDeclarations extends AirJamAgentStoreDeclarations,
>(
  contract: AirJamAgentContract<TSnapshot, TStoreDeclarations>,
): AirJamAgentContract<TSnapshot, TStoreDeclarations> => contract;
