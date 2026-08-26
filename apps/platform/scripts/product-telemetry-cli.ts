import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";
import { productTelemetryDeploymentEnvironmentSchema } from "../src/lib/product-telemetry-contract";
import { getProductTelemetryHealth } from "../src/server/product-telemetry/operations";
import {
  applyProductTelemetryRetention,
  previewProductTelemetryProjectionRebuild,
  rebuildProductTelemetryProjections,
} from "../src/server/product-telemetry/persistence";
import { getProductTelemetryOpsOverview } from "../src/server/product-telemetry/reporting";

const CLI_CONTRACT_VERSION = 1 as const;
const REPORTING_WINDOWS = [7, 30, 90] as const;

type ProductTelemetryCliInput =
  | {
      command: "overview";
      days: (typeof REPORTING_WINDOWS)[number];
      deploymentEnvironment: "production" | "preview" | "development" | "test";
      json: boolean;
    }
  | { command: "health"; json: boolean }
  | { command: "rebuild" | "retain"; apply: boolean; json: boolean };

const fail = (message: string): never => {
  throw new Error(message);
};

const parseInput = (raw: string | undefined): ProductTelemetryCliInput => {
  const serializedInput =
    raw ?? fail("Missing telemetry CLI operation payload.");

  let value: unknown;
  try {
    value = JSON.parse(serializedInput);
  } catch {
    fail("Telemetry CLI operation payload is not valid JSON.");
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("Telemetry CLI operation payload must be an object.");
  }

  const input = value as Record<string, unknown>;
  const json = input.json === true;

  if (input.command === "health") return { command: "health", json };
  if (input.command === "rebuild" || input.command === "retain") {
    return { command: input.command, apply: input.apply === true, json };
  }
  if (input.command === "overview") {
    const days = Number(input.days);
    if (
      !REPORTING_WINDOWS.includes(days as (typeof REPORTING_WINDOWS)[number])
    ) {
      fail("Telemetry overview days must be one of 7, 30, or 90.");
    }
    const deploymentEnvironment =
      productTelemetryDeploymentEnvironmentSchema.safeParse(
        input.deploymentEnvironment,
      );
    if (!deploymentEnvironment.success)
      return fail(
        "Telemetry environment must be production, preview, development, or test.",
      );
    return {
      command: "overview",
      days: days as (typeof REPORTING_WINDOWS)[number],
      deploymentEnvironment: deploymentEnvironment.data,
      json,
    };
  }

  return fail("Unknown telemetry CLI command.");
};

const printJson = (
  command: string,
  result: unknown,
  applied?: boolean,
): void => {
  console.log(
    JSON.stringify(
      {
        contractVersion: CLI_CONTRACT_VERSION,
        command,
        ...(applied === undefined ? {} : { applied }),
        result,
      },
      null,
      2,
    ),
  );
};

const printOverview = (
  result: Awaited<ReturnType<typeof getProductTelemetryOpsOverview>>,
): void => {
  console.log(
    `Product telemetry overview: ${result.window.deploymentEnvironment}, ${result.window.days} days`,
  );
  console.log(
    `Approximate product telemetry: ${result.productTelemetry.totals.pageViews} page views, ${result.productTelemetry.totals.anonymousSessions} anonymous sessions, ${result.productTelemetry.totals.intentEvents} intent events, ${result.productTelemetry.totals.agentResourceRequests} agent-resource requests`,
  );
  console.log(
    `Authoritative platform lifecycle: ${result.platformLifecycle.accountsCreated} accounts, ${result.platformLifecycle.gamesCreated} games, ${result.platformLifecycle.releasesCreated} releases created, ${result.platformLifecycle.releasesPublished} releases published`,
  );
  console.log(
    `Authoritative runtime usage: ${result.runtimeUsage.runtimeSessions} runtime sessions, ${result.runtimeUsage.gameSessions} game sessions, ${result.runtimeUsage.eligiblePlaytimeSeconds} eligible playtime seconds`,
  );
};

const printHealth = (
  result: Awaited<ReturnType<typeof getProductTelemetryHealth>>,
): void => {
  console.log(`Product telemetry storage: ${result.status}`);
  console.log(
    `Raw events: ${result.storage.rawEvents.count}; daily metrics: ${result.storage.dailyMetrics.count}; session contributions: ${result.storage.sessionContributions.count}`,
  );
  console.log(
    `Retention eligible: ${result.retention.eligibleRawEvents} raw events and ${result.retention.eligibleSessionContributions} session contributions`,
  );
};

const main = async (): Promise<void> => {
  const input = parseInput(process.argv[2]);
  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    fail(
      "DATABASE_URL is required. Set it directly or in apps/platform/.env.local.",
    );

  const client = postgres(databaseUrl, { max: 1 });
  const database = drizzle(client, { schema });

  try {
    if (input.command === "overview") {
      const result = await getProductTelemetryOpsOverview({
        days: input.days,
        deploymentEnvironment: input.deploymentEnvironment,
        database,
      });
      if (input.json) printJson(input.command, result);
      else printOverview(result);
      return;
    }

    if (input.command === "health") {
      const result = await getProductTelemetryHealth({ database });
      if (input.json) printJson(input.command, result);
      else printHealth(result);
      return;
    }

    if (input.command === "rebuild") {
      const result = input.apply
        ? await rebuildProductTelemetryProjections(database)
        : await previewProductTelemetryProjectionRebuild(database);
      if (input.json) printJson(input.command, result, input.apply);
      else {
        console.log(
          `${input.apply ? "Rebuilt" : "Would rebuild"} telemetry projections from ${result.rawEventCount} raw events into ${result.metricCount} daily metrics and ${result.sessionContributionCount} session contributions.`,
        );
        if (!input.apply) console.log("Pass --apply to execute the rebuild.");
      }
      return;
    }

    if (input.apply) {
      const result = await applyProductTelemetryRetention({ database });
      if (input.json) printJson(input.command, result, true);
      else {
        console.log(
          `Applied telemetry retention: deleted ${result.rawEventsDeleted} raw events and ${result.sessionContributionsDeleted} session contributions.`,
        );
      }
      return;
    }

    const health = await getProductTelemetryHealth({ database });
    const result = {
      rawCutoff: health.retention.rawCutoff,
      sessionContributionCutoffDate:
        health.retention.sessionContributionCutoffDate,
      rawEventsEligible: health.retention.eligibleRawEvents,
      sessionContributionsEligible:
        health.retention.eligibleSessionContributions,
    };
    if (input.json) printJson(input.command, result, false);
    else {
      console.log(
        `Would delete ${result.rawEventsEligible} raw events and ${result.sessionContributionsEligible} session contributions under the canonical retention policy.`,
      );
      console.log("Pass --apply to execute retention.");
    }
  } finally {
    await client.end();
  }
};

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Telemetry operation failed.",
  );
  process.exitCode = 1;
});
