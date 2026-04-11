export type AirJamGameActionCapabilityKind =
  | "button"
  | "axis"
  | "trigger"
  | "command"
  | "composite";

export type AirJamGameStateCapabilityKind =
  | "phase"
  | "boolean"
  | "number"
  | "enum"
  | "text"
  | "collection";

export type AirJamGameEvaluationCapabilityKind =
  | "success"
  | "failure"
  | "progress"
  | "score"
  | "quality";

export type AirJamGameCapabilityAudience = "host" | "controller" | "shared";

interface AirJamGameCapabilityDescriptorBase {
  key: string;
  label: string;
  description?: string;
  audience?: AirJamGameCapabilityAudience;
}

export interface AirJamGameActionCapability
  extends AirJamGameCapabilityDescriptorBase {
  kind: AirJamGameActionCapabilityKind;
}

export interface AirJamGameStateCapability
  extends AirJamGameCapabilityDescriptorBase {
  kind: AirJamGameStateCapabilityKind;
}

export interface AirJamGameEvaluationCapability
  extends AirJamGameCapabilityDescriptorBase {
  kind: AirJamGameEvaluationCapabilityKind;
}

export interface AirJamGameCapabilityManifest {
  version: 1;
  actions?: readonly AirJamGameActionCapability[];
  state?: readonly AirJamGameStateCapability[];
  evaluation?: readonly AirJamGameEvaluationCapability[];
}

export type DefineAirJamGameCapabilitiesInput = Omit<
  AirJamGameCapabilityManifest,
  "version"
> & {
  version?: 1;
};

const cloneSection = <T>(entries: readonly T[] | undefined): readonly T[] | undefined =>
  entries ? Object.freeze([...entries]) : undefined;

export const defineAirJamGameCapabilities = (
  input: DefineAirJamGameCapabilitiesInput,
): AirJamGameCapabilityManifest =>
  Object.freeze({
    version: 1,
    actions: cloneSection(input.actions),
    state: cloneSection(input.state),
    evaluation: cloneSection(input.evaluation),
  });
