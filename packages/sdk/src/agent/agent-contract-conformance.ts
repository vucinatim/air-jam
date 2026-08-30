import {
  describeAirJamAgentAction,
  resolveAirJamAgentActionPayload,
  type AnyAirJamAgentContract,
} from "./agent-contract.js";

export type AirJamAgentContractConformanceIssue = {
  code:
    | "store-domain-mismatch"
    | "missing-store-actions"
    | "missing-target-action"
    | "invalid-action-metadata"
    | "payload-parse-failed"
    | "snapshot-failed"
    | "snapshot-not-json";
  path: string;
  message: string;
};

export type AirJamAgentContractConformanceReport = {
  schemaVersion: 1;
  gameId: string;
  ok: boolean;
  storeDomains: string[];
  actionNames: string[];
  issues: AirJamAgentContractConformanceIssue[];
};

type InspectAirJamAgentContractConformanceOptions = {
  gameId: string;
  contract: AnyAirJamAgentContract;
  stores: Record<string, object>;
  controllerId?: string | null;
};

const representativePayload = (
  kind: ReturnType<typeof describeAirJamAgentAction>["payload"]["kind"],
  allowedValues?: string[],
): unknown => {
  switch (kind) {
    case "none":
      return undefined;
    case "boolean":
      return true;
    case "number":
      return 1;
    case "string":
      return "conformance";
    case "enum":
      return allowedValues?.[0];
    case "json":
      return {};
  }
};

const inspectJsonValue = (
  value: unknown,
  path: string,
  seen: Set<object>,
  issues: AirJamAgentContractConformanceIssue[],
): void => {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      issues.push({
        code: "snapshot-not-json",
        path,
        message: "Snapshot numbers must be finite.",
      });
    }
    return;
  }
  if (typeof value !== "object") {
    issues.push({
      code: "snapshot-not-json",
      path,
      message: `Snapshot value has unsupported type ${typeof value}.`,
    });
    return;
  }
  if (seen.has(value)) {
    issues.push({
      code: "snapshot-not-json",
      path,
      message: "Snapshot contains a circular reference.",
    });
    return;
  }

  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      inspectJsonValue(entry, `${path}[${index}]`, seen, issues),
    );
  } else {
    for (const [key, entry] of Object.entries(value)) {
      inspectJsonValue(entry, `${path}.${key}`, seen, issues);
    }
  }
  seen.delete(value);
};

export const inspectAirJamAgentContractConformance = async ({
  gameId,
  contract,
  stores,
  controllerId = "conformance-controller",
}: InspectAirJamAgentContractConformanceOptions): Promise<AirJamAgentContractConformanceReport> => {
  const issues: AirJamAgentContractConformanceIssue[] = [];
  const storeDomains = Object.keys(contract.stores).sort();
  const runtimeStoreDomains = Object.keys(stores).sort();
  const actionNames = Object.keys(contract.actions).sort();

  if (JSON.stringify(storeDomains) !== JSON.stringify(runtimeStoreDomains)) {
    issues.push({
      code: "store-domain-mismatch",
      path: "stores",
      message: `Declared domains [${storeDomains.join(", ")}] do not match runtime domains [${runtimeStoreDomains.join(", ")}].`,
    });
  }

  for (const [actionName, action] of Object.entries(contract.actions)) {
    const targetDomain = action.target.storeDomain ?? "default";
    const runtimeStore = stores[targetDomain] as
      | { actions?: Record<string, unknown> }
      | undefined;
    if (!runtimeStore?.actions || typeof runtimeStore.actions !== "object") {
      issues.push({
        code: "missing-store-actions",
        path: `actions.${actionName}.target`,
        message: `Runtime store "${targetDomain}" does not expose an actions object.`,
      });
    } else if (
      typeof runtimeStore.actions[action.target.actionName] !== "function"
    ) {
      issues.push({
        code: "missing-target-action",
        path: `actions.${actionName}.target`,
        message: `Runtime store "${targetDomain}" does not expose action "${action.target.actionName}".`,
      });
    }

    const metadata = describeAirJamAgentAction(action);
    if (
      !metadata.description?.trim() ||
      !metadata.resultDescription?.trim() ||
      (metadata.payload.kind === "enum" &&
        !metadata.payload.allowedValues?.length)
    ) {
      issues.push({
        code: "invalid-action-metadata",
        path: `actions.${actionName}`,
        message:
          "Every semantic action must describe its intent, expected result, and enum values when applicable.",
      });
    }

    try {
      resolveAirJamAgentActionPayload(
        action,
        representativePayload(
          metadata.payload.kind,
          metadata.payload.allowedValues,
        ),
        { gameId, actionName, contractKind: "conformance" },
      );
    } catch (error) {
      issues.push({
        code: "payload-parse-failed",
        path: `actions.${actionName}.input`,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  try {
    const snapshot = await contract.projectSnapshot({ controllerId, stores });
    inspectJsonValue(snapshot, "snapshot", new Set(), issues);
  } catch (error) {
    issues.push({
      code: "snapshot-failed",
      path: "snapshot",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    schemaVersion: 1,
    gameId,
    ok: issues.length === 0,
    storeDomains,
    actionNames,
    issues,
  };
};
