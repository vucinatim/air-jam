import {
  operationalLaneModeValues,
  operationalLaneValues,
  operationalQuotaKeyValues,
  type OperationalLane,
  type OperationalLaneMode,
  type OperationalQuotaKey,
} from "@air-jam/database-contract";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import {
  findOperationalBudgetEvidenceReplay,
  getOperationalBudgetStatus,
  previewOperationalBudgetEvidence,
  recordOperationalBudgetEvidence,
} from "../src/server/operations/production-budget-service";
import {
  getOperationalLaneControl,
  listOperationalLaneControls,
  PRODUCTION_CONTROL_CONTRACT_VERSION,
  setOperationalLaneControl,
} from "../src/server/operations/production-control-service";
import {
  OPERATIONAL_QUOTA_POLICIES,
  PRODUCTION_QUOTA_CONTRACT_VERSION,
} from "../src/server/operations/production-quota-policy";
import {
  decideOperationalQuotaAdmissionWithDatabase,
  listOperationalQuotaUsage,
} from "../src/server/operations/production-quota-service";

type ProductionControlCliInput =
  | { command: "status"; json: boolean }
  | { command: "budget-status"; json: boolean }
  | {
      command: "quota-status";
      creatorId: string;
      gameId?: string;
      json: boolean;
    }
  | {
      command: "quota-check";
      key: OperationalQuotaKey;
      lane: OperationalLane;
      creatorId: string;
      gameId?: string;
      requestedAmount: number;
      json: boolean;
    }
  | {
      command: "budget-replay";
      provider: string;
      scopeKind: string;
      scopeId: string;
      reason: string;
      actor: string;
      idempotencyKey: string;
      json: true;
    }
  | {
      command: "budget-sync";
      evidence: unknown;
      reason: string;
      actor: string;
      idempotencyKey: string;
      apply: boolean;
      json: boolean;
    }
  | {
      command: "lane-set";
      lane: OperationalLane;
      mode: OperationalLaneMode;
      reason: string;
      retryAfterSeconds: number | null;
      expectedRevision: number;
      actor: string;
      idempotencyKey: string;
      apply: boolean;
      json: boolean;
    };

const fail = (message: string): never => {
  throw new Error(message);
};

const readRequiredText = (
  input: Record<string, unknown>,
  key: string,
): string => {
  const value = typeof input[key] === "string" ? input[key].trim() : "";
  return value || fail(`${key} is required.`);
};

const readInteger = (
  input: Record<string, unknown>,
  key: string,
  minimum: number,
): number => {
  const value = Number(input[key]);
  if (!Number.isInteger(value) || value < minimum) {
    fail(`${key} must be an integer greater than or equal to ${minimum}.`);
  }
  return value;
};

const parseInput = (raw: string | undefined): ProductionControlCliInput => {
  const serializedInput = raw ?? fail("Missing production-control operation.");
  let value: unknown;
  try {
    value = JSON.parse(serializedInput);
  } catch {
    fail("Production-control operation is not valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("Production-control operation must be an object.");
  }

  const input = value as Record<string, unknown>;
  const json = input.json === true;
  if (input.command === "status") return { command: "status", json };
  if (input.command === "budget-status") {
    return { command: "budget-status", json };
  }
  if (input.command === "quota-status") {
    return {
      command: "quota-status",
      creatorId: readRequiredText(input, "creatorId"),
      gameId:
        typeof input.gameId === "string" && input.gameId.trim()
          ? input.gameId.trim()
          : undefined,
      json,
    };
  }
  if (input.command === "quota-check") {
    const key = readRequiredText(input, "key");
    if (!operationalQuotaKeyValues.includes(key as OperationalQuotaKey)) {
      fail(`key must be one of: ${operationalQuotaKeyValues.join(", ")}.`);
    }
    const lane = readRequiredText(input, "lane");
    if (!operationalLaneValues.includes(lane as OperationalLane)) {
      fail(`lane must be one of: ${operationalLaneValues.join(", ")}.`);
    }
    return {
      command: "quota-check",
      key: key as OperationalQuotaKey,
      lane: lane as OperationalLane,
      creatorId: readRequiredText(input, "creatorId"),
      gameId:
        typeof input.gameId === "string" && input.gameId.trim()
          ? input.gameId.trim()
          : undefined,
      requestedAmount: readInteger(input, "requestedAmount", 0),
      json,
    };
  }
  if (input.command === "budget-replay") {
    return {
      command: "budget-replay",
      provider: readRequiredText(input, "provider"),
      scopeKind: readRequiredText(input, "scopeKind"),
      scopeId: readRequiredText(input, "scopeId"),
      reason: readRequiredText(input, "reason"),
      actor: readRequiredText(input, "actor"),
      idempotencyKey: readRequiredText(input, "idempotencyKey"),
      json: true,
    };
  }
  if (input.command === "budget-sync") {
    return {
      command: "budget-sync",
      evidence: input.evidence,
      reason: readRequiredText(input, "reason"),
      actor: readRequiredText(input, "actor"),
      idempotencyKey: readRequiredText(input, "idempotencyKey"),
      apply: input.apply === true,
      json,
    };
  }
  if (input.command !== "lane-set") {
    return fail("Unknown production-control command.");
  }

  const lane = readRequiredText(input, "lane");
  if (!operationalLaneValues.includes(lane as OperationalLane)) {
    fail(`lane must be one of: ${operationalLaneValues.join(", ")}.`);
  }
  const mode = readRequiredText(input, "mode");
  if (!operationalLaneModeValues.includes(mode as OperationalLaneMode)) {
    fail(`mode must be one of: ${operationalLaneModeValues.join(", ")}.`);
  }

  const retryAfterSeconds =
    input.retryAfterSeconds === null || input.retryAfterSeconds === undefined
      ? null
      : readInteger(input, "retryAfterSeconds", 1);

  return {
    command: "lane-set",
    lane: lane as OperationalLane,
    mode: mode as OperationalLaneMode,
    reason: readRequiredText(input, "reason"),
    retryAfterSeconds,
    expectedRevision: readInteger(input, "expectedRevision", 0),
    actor: readRequiredText(input, "actor"),
    idempotencyKey: readRequiredText(input, "idempotencyKey"),
    apply: input.apply === true,
    json,
  };
};

const printJson = (
  command: string,
  applied: boolean,
  result: unknown,
): void => {
  console.log(
    JSON.stringify(
      {
        contractVersion: PRODUCTION_CONTROL_CONTRACT_VERSION,
        command,
        applied,
        result,
      },
      null,
      2,
    ),
  );
};

const main = async (): Promise<void> => {
  const input = parseInput(process.argv[2]);
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    fail(
      "DATABASE_URL is required. Set it directly or select a Railway environment through the repo CLI.",
    );
  const client = postgres(databaseUrl, { max: 1 });
  const database = drizzle(client, { schema });

  try {
    if (input.command === "status") {
      const result = {
        lanes: await listOperationalLaneControls({ database }),
        budget: await getOperationalBudgetStatus({ database }),
      };
      if (input.json) printJson(input.command, false, result);
      else {
        for (const lane of result.lanes) {
          console.log(
            `${lane.lane}: ${lane.mode} (revision ${lane.revision})${lane.reason ? ` — ${lane.reason}` : ""}`,
          );
        }
      }
      return;
    }

    if (input.command === "budget-status") {
      const result = { budget: await getOperationalBudgetStatus({ database }) };
      if (input.json) printJson(input.command, false, result);
      else {
        const { budget } = result;
        console.log(
          budget.state
            ? `Budget: ${budget.state} at $${(
                (budget.actualAmountMicrousd ?? 0) / 1_000_000
              ).toFixed(2)} (${budget.evidenceStatus} evidence).`
            : `Budget: unavailable (${budget.evidenceStatus} evidence).`,
        );
      }
      return;
    }

    if (input.command === "quota-status") {
      const [budget, quotas] = await Promise.all([
        getOperationalBudgetStatus({ database }),
        listOperationalQuotaUsage({
          database,
          creatorId: input.creatorId,
          gameId: input.gameId,
        }),
      ]);
      const result = {
        quotaContractVersion: PRODUCTION_QUOTA_CONTRACT_VERSION,
        policies: OPERATIONAL_QUOTA_POLICIES,
        budget,
        quotas,
      };
      if (input.json) printJson(input.command, false, result);
      else {
        console.log(
          `Quota authority for creator ${input.creatorId}${input.gameId ? ` and game ${input.gameId}` : ""}:`,
        );
        for (const quota of quotas) {
          console.log(
            quota.current === null
              ? `${quota.key}: unavailable — ${quota.authorityReason}`
              : `${quota.key}: ${quota.current}/${quota.limit} ${quota.unit}`,
          );
        }
      }
      return;
    }

    if (input.command === "quota-check") {
      const decision = await decideOperationalQuotaAdmissionWithDatabase({
        database,
        key: input.key,
        lane: input.lane,
        creatorId: input.creatorId,
        gameId: input.gameId,
        requestedAmount: input.requestedAmount,
      });
      if (input.json) printJson(input.command, false, { decision });
      else {
        console.log(
          `${decision.outcome}: ${decision.quotaKey} would move from ${decision.usage.current ?? "unavailable"} to ${decision.projectedUsage ?? "unavailable"} ${decision.usage.unit}${decision.reason ? ` (${decision.reason})` : ""}.`,
        );
      }
      return;
    }

    if (input.command === "budget-replay") {
      const evidence = await findOperationalBudgetEvidenceReplay({
        database,
        input,
      });
      const budget = evidence
        ? await getOperationalBudgetStatus({ database })
        : null;
      printJson(evidence ? "budget-sync" : input.command, evidence !== null, {
        evidence,
        budget,
        replayed: evidence !== null,
      });
      return;
    }

    if (input.command === "budget-sync") {
      const operationInput = {
        evidence: input.evidence,
        actor: input.actor,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
      };
      if (!input.apply) {
        const result = await previewOperationalBudgetEvidence({
          database,
          input: operationInput,
        });
        if (input.json) printJson(input.command, false, result);
        else {
          console.log(
            `Would record provider budget evidence and derive ${result.status.state ?? "unavailable"} state.`,
          );
          console.log("Pass --apply to persist this immutable evidence item.");
        }
        return;
      }

      const evidence = await recordOperationalBudgetEvidence({
        database,
        input: operationInput,
      });
      const budget = await getOperationalBudgetStatus({ database });
      const result = { evidence, budget, replayed: false };
      if (input.json) printJson(input.command, true, result);
      else {
        console.log(
          `Recorded ${evidence.provider} budget evidence at $${(
            evidence.actualAmountMicrousd / 1_000_000
          ).toFixed(2)}; derived ${budget.state ?? "unavailable"} state.`,
        );
      }
      return;
    }

    const current = await getOperationalLaneControl({
      database,
      lane: input.lane,
    });
    if (!input.apply) {
      const result = {
        current,
        requested: {
          lane: input.lane,
          mode: input.mode,
          reason: input.reason,
          retryAfterSeconds: input.retryAfterSeconds,
          expectedRevision: input.expectedRevision,
          actor: input.actor,
          idempotencyKey: input.idempotencyKey,
        },
        revisionMatches: current.revision === input.expectedRevision,
      };
      if (input.json) printJson(input.command, false, result);
      else {
        console.log(
          `Would set ${input.lane} from ${current.mode}@${current.revision} to ${input.mode}.`,
        );
        console.log(
          result.revisionMatches
            ? "Expected revision matches. Pass --apply to persist the change."
            : `Expected revision does not match current revision ${current.revision}; apply would fail.`,
        );
      }
      return;
    }

    const control = await setOperationalLaneControl({
      database,
      input: {
        lane: input.lane,
        mode: input.mode,
        reason: input.reason,
        retryAfterSeconds: input.retryAfterSeconds,
        expectedRevision: input.expectedRevision,
        actor: input.actor,
        idempotencyKey: input.idempotencyKey,
      },
    });
    if (input.json) printJson(input.command, true, { control });
    else {
      console.log(
        `Set ${control.lane} to ${control.mode} at revision ${control.revision}.`,
      );
    }
  } finally {
    await client.end();
  }
};

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Production-control operation failed.",
  );
  process.exitCode = 1;
});
