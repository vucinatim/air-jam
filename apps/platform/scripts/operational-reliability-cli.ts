import type { DeploymentEnvironment } from "@air-jam/operations-contract";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import {
  getOperationalEventDeliveryStatus,
  inspectOperationalEventDelivery,
  listOperationalEventDeliveries,
  previewOperationalEventDeadLetterRequeue,
  repairExpiredOperationalEventDeliveries,
  requeueOperationalEventDeadLetter,
  runOperationalEventDeliveryCycle,
} from "../src/server/operations/operational-event-delivery-service";
import {
  getOperationalReliabilityCatalog,
  getOperationalReliabilityStatus,
  listOperationalAlerts,
  listOperationalSyntheticRuns,
  resolveOperationalSyntheticRuntimeConfig,
  runDueOperationalSynthetics,
  runOperationalSynthetic,
} from "../src/server/operations/operational-synthetic-service";

type Input =
  | { command: "catalog"; json: boolean }
  | { command: "status"; environment?: string; json: boolean }
  | { command: "events-status"; json: boolean }
  | {
      command: "events-list";
      status?: "pending" | "delivering" | "delivered" | "dead_letter";
      limit: number;
      json: boolean;
    }
  | { command: "events-inspect"; eventId: string; json: boolean }
  | {
      command: "events-deliver-once";
      workerId: string;
      apply: boolean;
      json: boolean;
    }
  | {
      command: "events-repair-expired";
      limit: number;
      apply: boolean;
      json: boolean;
    }
  | {
      command: "events-requeue-dead-letter";
      eventId: string;
      actor: string;
      reason: string;
      idempotencyKey: string;
      maxAttempts: number;
      apply: boolean;
      json: boolean;
    }
  | {
      command: "synthetics-run";
      checkId: string;
      actor: string;
      reason: string;
      idempotencyKey: string;
      apply: boolean;
      json: boolean;
    }
  | {
      command: "synthetics-run-due";
      actor: string;
      apply: boolean;
      json: boolean;
    }
  | {
      command: "synthetics-list";
      checkId?: string;
      environment?: string;
      limit: number;
      json: boolean;
    }
  | {
      command: "alerts-list";
      environment?: string;
      status?: "open" | "recovered";
      json: boolean;
    };

const fail = (message: string): never => {
  throw new Error(message);
};

const requiredText = (input: Record<string, unknown>, key: string): string => {
  const value = typeof input[key] === "string" ? input[key].trim() : "";
  return value || fail(`${key} is required.`);
};

const optionalText = (input: Record<string, unknown>, key: string) => {
  const value = typeof input[key] === "string" ? input[key].trim() : "";
  return value || undefined;
};

const integer = (
  input: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
) => {
  const value = Number(input[key]);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail(`${key} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
};

const parseEnvironment = (
  value?: string,
): DeploymentEnvironment | undefined => {
  if (!value) return undefined;
  if (["production", "preview", "development", "test"].includes(value)) {
    return value as DeploymentEnvironment;
  }
  return fail("environment must be production, preview, development, or test.");
};

const parseInput = (): Input => {
  const raw = JSON.parse(process.argv[2] ?? "{}") as Record<string, unknown>;
  const command = requiredText(raw, "command");
  const json = Boolean(raw.json);
  switch (command) {
    case "catalog":
      return { command, json };
    case "status":
      return { command, environment: optionalText(raw, "environment"), json };
    case "events-status":
      return { command, json };
    case "events-list": {
      const status = optionalText(raw, "status");
      if (
        status &&
        !["pending", "delivering", "delivered", "dead_letter"].includes(status)
      ) {
        fail("status must be pending, delivering, delivered, or dead_letter.");
      }
      return {
        command,
        status: status as
          | "pending"
          | "delivering"
          | "delivered"
          | "dead_letter"
          | undefined,
        limit: integer(raw, "limit", 1, 500),
        json,
      };
    }
    case "events-inspect":
      return { command, eventId: requiredText(raw, "eventId"), json };
    case "events-deliver-once":
      return {
        command,
        workerId: requiredText(raw, "workerId"),
        apply: Boolean(raw.apply),
        json,
      };
    case "events-repair-expired":
      return {
        command,
        limit: integer(raw, "limit", 1, 500),
        apply: Boolean(raw.apply),
        json,
      };
    case "events-requeue-dead-letter":
      return {
        command,
        eventId: requiredText(raw, "eventId"),
        actor: requiredText(raw, "actor"),
        reason: requiredText(raw, "reason"),
        idempotencyKey: requiredText(raw, "idempotencyKey"),
        maxAttempts: integer(raw, "maxAttempts", 1, 20),
        apply: Boolean(raw.apply),
        json,
      };
    case "synthetics-run":
      return {
        command,
        checkId: requiredText(raw, "checkId"),
        actor: requiredText(raw, "actor"),
        reason: requiredText(raw, "reason"),
        idempotencyKey: requiredText(raw, "idempotencyKey"),
        apply: Boolean(raw.apply),
        json,
      };
    case "synthetics-run-due":
      return {
        command,
        actor: requiredText(raw, "actor"),
        apply: Boolean(raw.apply),
        json,
      };
    case "synthetics-list":
      return {
        command,
        checkId: optionalText(raw, "checkId"),
        environment: optionalText(raw, "environment"),
        limit: integer(raw, "limit", 1, 500),
        json,
      };
    case "alerts-list": {
      const status = optionalText(raw, "status");
      if (status && status !== "open" && status !== "recovered") {
        fail("status must be open or recovered.");
      }
      return {
        command,
        environment: optionalText(raw, "environment"),
        status: status as "open" | "recovered" | undefined,
        json,
      };
    }
    default:
      return fail(`Unknown operational reliability command ${command}.`);
  }
};

const print = (document: unknown, json: boolean) => {
  if (json) {
    console.log(JSON.stringify(document, null, 2));
    return;
  }
  console.log(JSON.stringify(document, null, 2));
};

const main = async () => {
  const input = parseInput();
  if (input.command === "catalog") {
    print(getOperationalReliabilityCatalog(), input.json);
    return;
  }
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    fail("DATABASE_URL is required for operational reliability state.");
  const client = postgres(databaseUrl, { max: 1 });
  const database = drizzle(client, { schema });
  try {
    const config = resolveOperationalSyntheticRuntimeConfig();
    let result: unknown;
    switch (input.command) {
      case "status":
        result = await getOperationalReliabilityStatus({
          database,
          environment:
            parseEnvironment(input.environment) ?? config.environment,
        });
        break;
      case "events-status":
        result = await getOperationalEventDeliveryStatus({ database });
        break;
      case "events-list":
        result = await listOperationalEventDeliveries({
          database,
          status: input.status,
          limit: input.limit,
        });
        break;
      case "events-inspect":
        result = await inspectOperationalEventDelivery({
          database,
          eventId: input.eventId,
        });
        break;
      case "events-deliver-once":
        result = input.apply
          ? await runOperationalEventDeliveryCycle({
              database,
              workerId: input.workerId,
            })
          : {
              applied: false,
              operation: "deliver one dependency-ready operational event",
              workerId: input.workerId,
            };
        break;
      case "events-repair-expired":
        result = input.apply
          ? {
              applied: true,
              repaired: await repairExpiredOperationalEventDeliveries({
                database,
                limit: input.limit,
              }),
            }
          : {
              applied: false,
              operation: "repair expired delivery leases",
              limit: input.limit,
            };
        break;
      case "events-requeue-dead-letter":
        result = input.apply
          ? await requeueOperationalEventDeadLetter({
              database,
              eventId: input.eventId,
              actor: input.actor,
              reason: input.reason,
              idempotencyKey: input.idempotencyKey,
              maxAttempts: input.maxAttempts,
            })
          : await previewOperationalEventDeadLetterRequeue({
              database,
              eventId: input.eventId,
              maxAttempts: input.maxAttempts,
            });
        break;
      case "synthetics-run":
        result = input.apply
          ? await runOperationalSynthetic({
              database,
              checkId: input.checkId,
              actor: input.actor,
              reason: input.reason,
              idempotencyKey: input.idempotencyKey,
              config,
            })
          : {
              applied: false,
              checkId: input.checkId,
              environment: config.environment,
              targetConfiguration: Object.fromEntries(
                Object.entries(config.targets).map(([key, value]) => [
                  key,
                  Boolean(value),
                ]),
              ),
              appIdentityConfigured: Boolean(config.appId),
            };
        break;
      case "synthetics-run-due":
        result = input.apply
          ? {
              applied: true,
              runs: await runDueOperationalSynthetics({
                database,
                actor: input.actor,
                config,
              }),
            }
          : {
              applied: false,
              operation: "run every due launch-critical synthetic",
              environment: config.environment,
            };
        break;
      case "synthetics-list":
        result = await listOperationalSyntheticRuns({
          database,
          checkId: input.checkId,
          environment: parseEnvironment(input.environment),
          limit: input.limit,
        });
        break;
      case "alerts-list":
        result = await listOperationalAlerts({
          database,
          environment: parseEnvironment(input.environment),
          status: input.status,
        });
        break;
    }
    print(
      {
        contractVersion: 1,
        command: input.command,
        applied: "apply" in input ? input.apply : false,
        result,
      },
      input.json,
    );
  } finally {
    await client.end();
  }
};

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error
      ? error.message
      : "Operational reliability command failed.",
  );
  process.exitCode = 1;
});
