export type AirJamGameAgentJsonObject = Record<string, unknown>;

export type AirJamGameAgentPayloadKind =
  | "none"
  | "boolean"
  | "number"
  | "string"
  | "enum"
  | "json";

export type AirJamGameAgentPayloadMetadata = {
  kind: AirJamGameAgentPayloadKind;
  description?: string;
  allowedValues?: string[];
};

export type AirJamGameAgentActionTarget = {
  kind: "controller";
  actionName: string;
  storeDomain?: string;
};

export type AirJamGameAgentActionContract = {
  target: AirJamGameAgentActionTarget;
  description?: string;
  availability?: string;
  payload: AirJamGameAgentPayloadMetadata;
  resultDescription?: string;
  resolveInput?: (input: unknown) => unknown;
};

export type AirJamGameAgentSnapshotContext = {
  controllerId: string | null;
  stores: Record<string, AirJamGameAgentJsonObject>;
};

export type AirJamGameAgentContract<
  TSnapshot extends AirJamGameAgentJsonObject = AirJamGameAgentJsonObject,
> = {
  gameId: string;
  snapshotStoreDomains?: string[];
  snapshotDescription?: string;
  projectSnapshot: (
    context: AirJamGameAgentSnapshotContext,
  ) => TSnapshot | Promise<TSnapshot>;
  actions: Record<string, AirJamGameAgentActionContract>;
};

export const defineAirJamGameAgentContract = <
  TSnapshot extends AirJamGameAgentJsonObject,
>(
  contract: AirJamGameAgentContract<TSnapshot>,
): AirJamGameAgentContract<TSnapshot> => contract;
