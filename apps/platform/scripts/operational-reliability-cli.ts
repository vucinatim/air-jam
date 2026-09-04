import {
  deploymentEnvironments,
  type DeploymentEnvironment,
} from "@air-jam/operations-contract";
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
import { getOperationalReliabilityCatalog } from "../src/server/operations/operational-reliability-policy";
import { runDueOperationalSynthetics } from "../src/server/operations/operational-synthetic-scheduler";
import {
  getOperationalReliabilityStatus,
  inspectOperationalAlert,
  listOperationalAlerts,
  listOperationalSyntheticRuns,
  resolveOperationalSyntheticRuntimeConfig,
  runOperationalSynthetic,
} from "../src/server/operations/operational-synthetic-service";
import {
  createGitHubAlertIssueProjector,
  resolveGitHubAlertIssueConfig,
} from "../src/server/operations/github-alert-issue-adapter";
import {
  getOperationalAlertIssueProjectionStatus,
  inspectOperationalAlertIssueProjection,
  listOperationalAlertIssueProjections,
  repairExpiredOperationalAlertIssueProjections,
  requeueOperationalAlertIssueProjection,
  runOperationalAlertIssueProjectionCycle,
} from "../src/server/operations/operational-alert-issue-projection-service";

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
    }
  | { command: "alerts-inspect"; alertKey: string; json: boolean }
  | { command: "issues-status"; repository?: string; json: boolean }
  | {
      command: "issues-list";
      repository?: string;
      status?: "pending" | "delivering" | "delivered" | "dead_letter";
      limit: number;
      json: boolean;
    }
  | {
      command: "issues-inspect";
      repository: string;
      alertKey: string;
      json: boolean;
    }
  | {
      command: "issues-project-once";
      workerId: string;
      apply: boolean;
      json: boolean;
    }
  | {
      command: "issues-repair-expired";
      repository?: string;
      limit: number;
      apply: boolean;
      json: boolean;
    }
  | {
      command: "issues-requeue-dead-letter";
      repository: string;
      alertKey: string;
      actor: string;
      reason: string;
      idempotencyKey: string;
      maxAttempts: number;
      apply: boolean;
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
  if (deploymentEnvironments.includes(value as DeploymentEnvironment)) {
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
    case "alerts-inspect":
      return {
        command,
        alertKey: requiredText(raw, "alertKey"),
        json,
      };
    case "issues-status":
      return { command, repository: optionalText(raw, "repository"), json };
    case "issues-list": {
      const status = optionalText(raw, "status");
      if (
        status &&
        !["pending", "delivering", "delivered", "dead_letter"].includes(
          status,
        )
      ) {
        fail("status must be pending, delivering, delivered, or dead_letter.");
      }
      return {
        command,
        repository: optionalText(raw, "repository"),
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
    case "issues-inspect":
      return {
        command,
        repository: requiredText(raw, "repository"),
        alertKey: requiredText(raw, "alertKey"),
        json,
      };
    case "issues-project-once":
      return {
        command,
        workerId: requiredText(raw, "workerId"),
        apply: Boolean(raw.apply),
        json,
      };
    case "issues-repair-expired":
      return {
        command,
        repository: optionalText(raw, "repository"),
        limit: integer(raw, "limit", 1, 500),
        apply: Boolean(raw.apply),
        json,
      };
    case "issues-requeue-dead-letter":
      return {
        command,
        repository: requiredText(raw, "repository"),
        alertKey: requiredText(raw, "alertKey"),
        actor: requiredText(raw, "actor"),
        reason: requiredText(raw, "reason"),
        idempotencyKey: requiredText(raw, "idempotencyKey"),
        maxAttempts: integer(raw, "maxAttempts", 1, 20),
        apply: Boolean(raw.apply),
        json,
      };
    default:
      return fail(`Unknown operational reliability command ${command}.`);
  }
};

const print = (document: unknown) => {
  console.log(JSON.stringify(document, null, 2));
};

const main = async () => {
  const input = parseInput();
  if (input.command === "catalog") {
    print(getOperationalReliabilityCatalog());
    return;
  }
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    fail("DATABASE_URL is required for operational reliability state.");
  const client = postgres(databaseUrl, { max: 1 });
  const database = drizzle(client, { schema });
  try {
    const config = resolveOperationalSyntheticRuntimeConfig();
    const githubIssueConfig =
      input.command === "issues-project-once"
        ? resolveGitHubAlertIssueConfig()
        : null;
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
              batch: await runDueOperationalSynthetics({
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
      case "alerts-inspect":
        result = await inspectOperationalAlert({
          database,
          alertKey: input.alertKey,
        });
        break;
      case "issues-status":
        result = await getOperationalAlertIssueProjectionStatus({
          database,
          repository: input.repository,
        });
        break;
      case "issues-list":
        result = await listOperationalAlertIssueProjections({
          database,
          repository: input.repository,
          status: input.status,
          limit: input.limit,
        });
        break;
      case "issues-inspect":
        result = await inspectOperationalAlertIssueProjection({
          database,
          repository: input.repository,
          alertKey: input.alertKey,
        });
        break;
      case "issues-project-once":
        result = input.apply
          ? githubIssueConfig?.enabled
            ? await runOperationalAlertIssueProjectionCycle({
                database,
                repository: githubIssueConfig.repository,
                workerId: input.workerId,
                projector: createGitHubAlertIssueProjector({
                  config: githubIssueConfig,
                }),
              })
            : fail(
                "GitHub issue projection is not configured for this process.",
              )
          : {
              applied: false,
              operation: "project one dependency-ready alert to GitHub",
              configured: Boolean(githubIssueConfig?.enabled),
              repository: githubIssueConfig?.enabled
                ? githubIssueConfig.repository
                : null,
              workerId: input.workerId,
            };
        break;
      case "issues-repair-expired":
        result = input.apply
          ? {
              applied: true,
              repaired: await repairExpiredOperationalAlertIssueProjections({
                database,
                repository: input.repository,
                limit: input.limit,
              }),
            }
          : {
              applied: false,
              operation: "repair expired GitHub issue projection leases",
              repository: input.repository ?? null,
              limit: input.limit,
            };
        break;
      case "issues-requeue-dead-letter":
        result = input.apply
          ? await requeueOperationalAlertIssueProjection({
              database,
              repository: input.repository,
              alertKey: input.alertKey,
              actor: input.actor,
              reason: input.reason,
              idempotencyKey: input.idempotencyKey,
              maxAttempts: input.maxAttempts,
            })
          : {
              applied: false,
              operation: "requeue one dead-lettered GitHub issue projection",
              eligible:
                (
                  await inspectOperationalAlertIssueProjection({
                    database,
                    repository: input.repository,
                    alertKey: input.alertKey,
                  })
                )?.status === "dead_letter",
              repository: input.repository,
              alertKey: input.alertKey,
              maxAttempts: input.maxAttempts,
            };
        break;
    }
    print({
      contractVersion: 1,
      command: input.command,
      applied: "apply" in input ? input.apply : false,
      result,
    });
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
