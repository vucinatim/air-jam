import {
  type AirJamMachineActionInputDefinition,
  type AirJamMachineActionMetadata,
  type AirJamMachineActionParseMeta,
  type AirJamMachineActionPayloadKind,
  type AirJamMachineActionPayloadMetadata,
  type AirJamMachineActionOptions,
} from "./machine-action.js";

export type AirJamGameAgentJsonObject = Record<string, unknown>;

export type AirJamGameAgentPayloadKind = AirJamMachineActionPayloadKind;

export type AirJamGameAgentPayloadMetadata = AirJamMachineActionPayloadMetadata;

export type AirJamGameAgentStoreDeclaration<TStore extends object = object> = {
  readonly __store?: TStore;
};

export type AirJamGameAgentStoreDeclarations = Record<
  string,
  AirJamGameAgentStoreDeclaration<any>
>;

export type AirJamGameAgentActionTarget = {
  kind: "controller";
  actionName: string;
  storeDomain?: string;
};

export type AirJamGameAgentStores = Record<string, object>;

export type InferAirJamGameAgentStores<
  TDeclarations extends AirJamGameAgentStoreDeclarations,
> = {
  [TKey in keyof TDeclarations]: TDeclarations[TKey] extends AirJamGameAgentStoreDeclaration<
    infer TStore
  >
    ? TStore
    : never;
};

type AirJamGameAgentActionContractBase = {
  target: AirJamGameAgentActionTarget;
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

export type AirJamGameAgentResolvedActionContract<
  TInput = unknown,
  TPayload = TInput,
> = AirJamGameAgentActionContractBase & {
  input: AirJamMachineActionInputDefinition<TInput>;
  toPayload?: (input: TInput) => TPayload;
};

export type AirJamGameAgentActionContract =
  AirJamGameAgentResolvedActionContract<any, any>;

export type AirJamGameAgentActionOptions<TInput, TPayload = TInput> =
  AirJamMachineActionOptions & {
    availability?: string;
    input: AirJamMachineActionInputDefinition<TInput>;
    toPayload?: (input: TInput) => TPayload;
  };

export type AirJamGameAgentSnapshotContext<
  TStores extends AirJamGameAgentStores = AirJamGameAgentStores,
> = {
  controllerId: string | null;
  stores: Partial<TStores>;
};

export type AirJamGameAgentContract<
  TSnapshot extends AirJamGameAgentJsonObject = AirJamGameAgentJsonObject,
  TStoreDeclarations extends AirJamGameAgentStoreDeclarations = AirJamGameAgentStoreDeclarations,
> = {
  snapshotStores: TStoreDeclarations;
  snapshotDescription?: string;
  projectSnapshot: (
    context: AirJamGameAgentSnapshotContext<
      InferAirJamGameAgentStores<TStoreDeclarations>
    >,
  ) => TSnapshot | Promise<TSnapshot>;
  actions: Record<string, AirJamGameAgentActionContract>;
};

export const gameAgentStore = <
  TStore extends object,
>(): AirJamGameAgentStoreDeclaration<TStore> =>
  ({}) as AirJamGameAgentStoreDeclaration<TStore>;

export const defineAirJamGameAgentStores = <
  TDeclarations extends AirJamGameAgentStoreDeclarations,
>(
  stores: TDeclarations,
): TDeclarations => stores;

export const readAirJamGameStore = <
  TStores extends AirJamGameAgentStores,
  TKey extends keyof TStores,
>(
  context: AirJamGameAgentSnapshotContext<TStores>,
  storeDomain: TKey,
): TStores[TKey] | null => context.stores[storeDomain] ?? null;

export const readAirJamDefaultGameStore = <
  TStores extends { default: object },
>(
  context: AirJamGameAgentSnapshotContext<TStores>,
): TStores["default"] | null => context.stores.default ?? null;

export const getAirJamGameAgentStoreDomains = (
  contract: AirJamGameAgentContract<any, any>,
): string[] => Object.keys(contract.snapshotStores);

export const getAirJamGameAgentActionMetadata = (
  action: AirJamGameAgentActionContract,
): AirJamMachineActionMetadata =>
  ({
    description: action.description ?? action.input.metadata.description,
    payload: {
      ...action.input.metadata.payload,
    },
    resultDescription:
      action.resultDescription ?? action.input.metadata.resultDescription,
  });

export const resolveAirJamGameAgentActionPayload = (
  action: AirJamGameAgentActionContract,
  payload: unknown,
  meta: AirJamMachineActionParseMeta,
): unknown => {
  const parsedInput = action.input.parse(payload, meta);
  return action.toPayload ? action.toPayload(parsedInput) : parsedInput;
};

export const gameAgentAction = {
  player: <TInput, TPayload = TInput>(
    target: Omit<AirJamGameAgentActionTarget, "kind">,
    options: AirJamGameAgentActionOptions<TInput, TPayload>,
  ): AirJamGameAgentResolvedActionContract<TInput, TPayload> => ({
    target: {
      kind: "controller",
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

export const defineAirJamGameAgentContract = <
  TSnapshot extends AirJamGameAgentJsonObject,
  TStoreDeclarations extends AirJamGameAgentStoreDeclarations,
>(
  contract: AirJamGameAgentContract<TSnapshot, TStoreDeclarations>,
): AirJamGameAgentContract<TSnapshot, TStoreDeclarations> => contract;
