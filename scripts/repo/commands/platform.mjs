import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertGeneratedContentBlogSourceIsFresh } from "../../content/lib/content-blog-source-generator.mjs";
import { assertGeneratedContentDocsSourceIsFresh } from "../../content/lib/content-docs-source-generator.mjs";
import {
  generatePlatformAiPackArtifacts,
  readRelativeTree,
} from "../../platform/lib/platform-ai-pack-artifacts.mjs";
import { preparePlatformGeneratedArtifacts } from "../../platform/lib/platform-generated-prepare.mjs";
import { createRailwayApiClient } from "../lib/railway-api.mjs";
import { runCommand, runCommandResult } from "../lib/shell.mjs";
import { runRepoPlatformDbBackupCommand } from "./platform-db-backup.mjs";

const logGeneratedPrepareResult = (result) => {
  console.log(
    `✓ Platform generated artifacts are ready (${result.channel}@${result.packVersion}, ${result.fileCount} files)`,
  );
};

const runPlatformGeneratedPrepare = async () => {
  const result = await preparePlatformGeneratedArtifacts();
  logGeneratedPrepareResult(result);
};

const assertPlatformAiPackGenerationIsDeterministic = async () => {
  const firstRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "airjam-platform-ai-pack-check-a-"),
  );
  const secondRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "airjam-platform-ai-pack-check-b-"),
  );

  try {
    const [firstResult, secondResult] = await Promise.all([
      generatePlatformAiPackArtifacts({ targetRoot: firstRoot }),
      generatePlatformAiPackArtifacts({ targetRoot: secondRoot }),
    ]);
    const [firstTree, secondTree] = await Promise.all([
      readRelativeTree(firstRoot),
      readRelativeTree(secondRoot),
    ]);
    const firstPaths = [...firstTree.keys()].sort();
    const secondPaths = [...secondTree.keys()].sort();

    if (JSON.stringify(firstPaths) !== JSON.stringify(secondPaths)) {
      throw new Error("Hosted AI pack generation produced unstable file sets.");
    }

    for (const relativePath of firstPaths) {
      if (firstTree.get(relativePath) !== secondTree.get(relativePath)) {
        throw new Error(
          `Hosted AI pack generation is nondeterministic: ${relativePath}.`,
        );
      }
    }

    const requiredManifestPaths = [
      "manifest.json",
      `${firstResult.channel}/manifest.json`,
      `${firstResult.channel}/${firstResult.packVersion}/manifest.json`,
    ];
    for (const relativePath of requiredManifestPaths) {
      if (!firstTree.has(relativePath)) {
        throw new Error(
          `Hosted AI pack generation omitted required artifact: ${relativePath}.`,
        );
      }
    }

    if (
      firstResult.channel !== secondResult.channel ||
      firstResult.packVersion !== secondResult.packVersion ||
      firstResult.fileCount !== secondResult.fileCount ||
      firstPaths.length !== firstResult.fileCount + requiredManifestPaths.length
    ) {
      throw new Error(
        "Hosted AI pack generation returned inconsistent metadata.",
      );
    }

    return firstResult;
  } finally {
    await Promise.all([
      fs.promises.rm(firstRoot, { recursive: true, force: true }),
      fs.promises.rm(secondRoot, { recursive: true, force: true }),
    ]);
  }
};

const runPlatformGeneratedCheck = async () => {
  runCommand("pnpm", ["--filter", "@air-jam/cli", "ai-pack:check"]);
  await Promise.all([
    assertGeneratedContentDocsSourceIsFresh(),
    assertGeneratedContentBlogSourceIsFresh(),
  ]);

  const result = await assertPlatformAiPackGenerationIsDeterministic();
  console.log(
    `✓ Platform generated sources are fresh and AI pack generation is deterministic (${result.channel}@${result.packVersion}, ${result.fileCount} files)`,
  );
};

const runPlatformAiPackCheck = async () => {
  const result = await assertPlatformAiPackGenerationIsDeterministic();
  console.log(
    `✓ Hosted platform AI pack generation is deterministic (${result.channel}@${result.packVersion}, ${result.fileCount} files)`,
  );
};

const runRailwayJson = (args, operation) => {
  const result = runCommandResult("railway", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) {
    throw new Error(
      `Railway CLI is required for ${operation} when project-token access is unavailable: ${result.error.message}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || `Railway ${operation} failed without an error.`,
    );
  }
  return JSON.parse(result.stdout);
};

export const resolveRailwayPlatformDatabaseUrlWithCli = (
  { environmentId, projectId },
  readRailwayJson = runRailwayJson,
) => {
  if (!projectId) {
    throw new Error(
      "Remote telemetry requires --railway-project or RAILWAY_PROJECT_ID when project-token access cannot inspect the environment.",
    );
  }

  const services = readRailwayJson(
    [
      "service",
      "list",
      "--project",
      projectId,
      "--environment",
      environmentId,
      "--json",
    ],
    "service discovery",
  );
  const postgresService = services.find(
    (service) =>
      service.name?.toLowerCase().includes("postgres") ||
      service.source?.image?.toLowerCase().includes("postgres"),
  );
  if (!postgresService) {
    throw new Error(
      `Could not find PostgreSQL in Railway environment ${environmentId}.`,
    );
  }

  const variables = readRailwayJson(
    [
      "variable",
      "list",
      "--project",
      projectId,
      "--environment",
      environmentId,
      "--service",
      postgresService.id,
      "--json",
    ],
    "database credential resolution",
  );
  const databaseUrl =
    variables.DATABASE_PUBLIC_URL ?? variables.DATABASE_URL ?? null;
  if (!databaseUrl) {
    throw new Error(
      `PostgreSQL in Railway environment ${environmentId} has no database URL.`,
    );
  }
  return databaseUrl;
};

export const resolveRailwayPlatformDatabaseUrl = async (
  { environmentId, projectId },
  {
    createClient = createRailwayApiClient,
    resolveWithCli = resolveRailwayPlatformDatabaseUrlWithCli,
  } = {},
) => {
  try {
    const client = createClient();
    const environment = await client.getEnvironment(environmentId);
    const infrastructureServices = environment.serviceInstances.filter(
      (instance) => !instance.railwayConfigFile,
    );

    for (const service of infrastructureServices) {
      const variables = await client.getVariables({
        projectId: environment.projectId,
        environmentId: environment.id,
        serviceId: service.serviceId,
      });
      const databaseUrl =
        variables.DATABASE_PUBLIC_URL ?? variables.DATABASE_URL ?? null;
      if (databaseUrl) return databaseUrl;
    }
  } catch {
    // Project tokens may not inspect ephemeral PR environments. The bounded
    // authenticated CLI fallback below preserves one repo-owned command.
  }

  return resolveWithCli({
    environmentId,
    projectId: projectId ?? process.env.RAILWAY_PROJECT_ID ?? null,
  });
};

const runPlatformDatabaseOperator = async ({ script, operation, options }) => {
  const databaseUrl = options.railwayEnvironment
    ? await resolveRailwayPlatformDatabaseUrl({
        environmentId: options.railwayEnvironment,
        projectId: options.railwayProject ?? null,
      })
    : null;

  runCommand(
    "pnpm",
    [
      "--filter",
      "platform",
      "exec",
      "tsx",
      "--env-file-if-exists=.env.local",
      script,
      JSON.stringify(operation),
    ],
    {
      env: databaseUrl ? { DATABASE_URL: databaseUrl } : undefined,
    },
  );
};

const capturePlatformDatabaseOperator = async ({
  script,
  operation,
  options,
}) => {
  const databaseUrl = options.railwayEnvironment
    ? await resolveRailwayPlatformDatabaseUrl({
        environmentId: options.railwayEnvironment,
        projectId: options.railwayProject ?? null,
      })
    : null;
  const result = runCommandResult(
    "pnpm",
    [
      "--filter",
      "platform",
      "exec",
      "tsx",
      "--env-file-if-exists=.env.local",
      script,
      JSON.stringify(operation),
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: databaseUrl ? { DATABASE_URL: databaseUrl } : undefined,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      result.stderr?.trim() || "Platform database operation failed.",
    );
  }
  return result.stdout;
};

const addPlatformDatabaseTargetOption = (command) =>
  command
    .option(
      "--railway-environment <id>",
      "Operate an explicit Railway environment without printing its database credentials",
    )
    .option(
      "--railway-project <id>",
      "Railway project id; defaults to RAILWAY_PROJECT_ID",
    );

export const collectRailwayProjectBudgetEvidence = async (
  { projectId },
  { createClient = createRailwayApiClient } = {},
) => {
  if (!projectId?.trim()) {
    throw new Error(
      "Budget sync requires --railway-project or RAILWAY_PROJECT_ID.",
    );
  }
  return createClient().getProjectUsageEvidence({
    projectId: projectId.trim(),
  });
};

export const registerPlatformCommands = (program) => {
  const platformCommand = program
    .command("platform")
    .description("Platform maintainer helpers");

  const generatedCommand = platformCommand
    .command("generated")
    .description("Prepare or verify generated platform artifacts");

  generatedCommand
    .command("prepare")
    .description(
      "Generate platform content sources and hosted AI pack artifacts",
    )
    .action(runPlatformGeneratedPrepare);

  generatedCommand
    .command("check")
    .description(
      "Verify platform content sources and hosted AI pack artifacts are fresh",
    )
    .action(runPlatformGeneratedCheck);

  const aiPackCommand = platformCommand
    .command("ai-pack")
    .description("Hosted platform AI pack artifact helpers");

  aiPackCommand
    .command("generate")
    .description("Generate hosted platform AI pack artifacts")
    .action(async () => {
      const result = await generatePlatformAiPackArtifacts();
      console.log(
        `✓ Generated hosted AI pack artifacts for ${result.channel}@${result.packVersion} (${result.fileCount} files)`,
      );
    });

  aiPackCommand
    .command("check")
    .description("Verify hosted platform AI pack generation is deterministic")
    .action(async () => {
      await runPlatformAiPackCheck();
    });

  const telemetryCommand = platformCommand
    .command("telemetry")
    .description(
      "Inspect and operate first-party product telemetry through agent-safe contracts",
    );

  addPlatformDatabaseTargetOption(
    telemetryCommand
      .command("overview")
      .description(
        "Read the authority-separated product, lifecycle, and runtime overview",
      )
      .option("--days <days>", "Reporting window: 7, 30, or 90", "30")
      .option(
        "--environment <environment>",
        "Deployment environment: production, preview, development, or test",
        "production",
      )
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/product-telemetry-cli.ts",
      operation: {
        command: "overview",
        days: options.days,
        deploymentEnvironment: options.environment,
        json: Boolean(options.json),
      },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    telemetryCommand
      .command("health")
      .description(
        "Inspect telemetry storage, projection freshness, and retention eligibility",
      )
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/product-telemetry-cli.ts",
      operation: {
        command: "health",
        json: Boolean(options.json),
      },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    telemetryCommand
      .command("rebuild")
      .description(
        "Preview or apply a deterministic projection rebuild from retained raw events",
      )
      .option("--apply", "Apply the rebuild; omission is a read-only preview")
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/product-telemetry-cli.ts",
      operation: {
        command: "rebuild",
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    telemetryCommand
      .command("retain")
      .description(
        "Preview or apply the canonical raw-event and session-contribution retention policy",
      )
      .option(
        "--apply",
        "Delete eligible records; omission is a read-only preview",
      )
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/product-telemetry-cli.ts",
      operation: {
        command: "retain",
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    });
  });

  const operationsCommand = platformCommand
    .command("operations")
    .description(
      "Inspect and operate production controls through agent-safe contracts",
    );

  addPlatformDatabaseTargetOption(
    operationsCommand
      .command("status")
      .description("Inspect every canonical expensive-lane control")
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: { command: "status", json: Boolean(options.json) },
      options,
    });
  });

  const laneCommand = operationsCommand
    .command("lane")
    .description("Inspect and mutate one expensive-lane control");

  addPlatformDatabaseTargetOption(
    laneCommand
      .command("set")
      .description("Preview or apply an optimistic, audited lane-mode change")
      .requiredOption("--lane <lane>", "Canonical production lane")
      .requiredOption("--mode <mode>", "normal, restricted, or paused")
      .requiredOption("--reason <reason>", "Durable operator reason")
      .requiredOption("--actor <actor>", "Audited operator identity")
      .requiredOption(
        "--idempotency-key <key>",
        "Stable idempotency key for this logical mutation",
      )
      .requiredOption(
        "--expected-revision <revision>",
        "Revision returned by operations status",
      )
      .option(
        "--retry-after-seconds <seconds>",
        "Positive retry guidance returned while paused",
      )
      .option(
        "--apply",
        "Persist the mutation; omission is a read-only preview",
      )
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "lane-set",
        lane: options.lane,
        mode: options.mode,
        reason: options.reason,
        actor: options.actor,
        idempotencyKey: options.idempotencyKey,
        expectedRevision: options.expectedRevision,
        retryAfterSeconds: options.retryAfterSeconds ?? null,
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    });
  });

  const budgetCommand = operationsCommand
    .command("budget")
    .description(
      "Inspect and ingest immutable provider spend evidence; state is always derived",
    );

  addPlatformDatabaseTargetOption(
    budgetCommand
      .command("status")
      .description(
        "Inspect the current cycle, evidence freshness, spend, forecast, and derived state",
      )
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: { command: "budget-status", json: Boolean(options.json) },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    budgetCommand
      .command("sync")
      .description(
        "Fetch Railway project usage, preview the derived budget result, or persist the evidence",
      )
      .requiredOption("--reason <reason>", "Durable evidence-collection reason")
      .requiredOption("--actor <actor>", "Audited collector identity")
      .requiredOption(
        "--idempotency-key <key>",
        "Stable idempotency key for this logical provider snapshot",
      )
      .option(
        "--apply",
        "Persist the immutable evidence; omission is a read-only preview",
      )
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    const projectId =
      options.railwayProject ?? process.env.RAILWAY_PROJECT_ID ?? null;
    if (!projectId?.trim()) {
      throw new Error(
        "Budget sync requires --railway-project or RAILWAY_PROJECT_ID.",
      );
    }
    const replayOutput = await capturePlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "budget-replay",
        provider: "railway",
        scopeKind: "project",
        scopeId: projectId.trim(),
        reason: options.reason,
        actor: options.actor,
        idempotencyKey: options.idempotencyKey,
        json: true,
      },
      options,
    });
    const replay = JSON.parse(replayOutput);
    if (replay?.result?.replayed === true) {
      process.stdout.write(replayOutput);
      return;
    }
    const evidence = await collectRailwayProjectBudgetEvidence({ projectId });
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "budget-sync",
        evidence,
        reason: options.reason,
        actor: options.actor,
        idempotencyKey: options.idempotencyKey,
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    });
  });

  const lifecycleCommand = operationsCommand
    .command("lifecycle")
    .description(
      "Inspect and operate automatic product-resource retention through durable jobs",
    );

  addPlatformDatabaseTargetOption(
    lifecycleCommand
      .command("cleanup")
      .description(
        "Preview exact retention-eligible storage or enqueue bounded cleanup jobs",
      )
      .requiredOption("--actor <actor>", "Audited operator identity")
      .requiredOption("--reason <reason>", "Durable operator reason")
      .requiredOption(
        "--idempotency-key <key>",
        "Stable idempotency key for this logical cleanup schedule",
      )
      .option(
        "--limit <limit>",
        "Maximum resources to inspect or schedule, from 1 to 500",
        "100",
      )
      .option(
        "--apply",
        "Enqueue durable cleanup jobs; omission is an exact read-only preview",
      )
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "lifecycle-cleanup",
        actor: options.actor,
        reason: options.reason,
        idempotencyKey: options.idempotencyKey,
        limit: options.limit,
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    });
  });

  const quotaCommand = operationsCommand
    .command("quota")
    .description(
      "Inspect authoritative free-cloud usage and preview shadow or enforced admission decisions",
    );

  addPlatformDatabaseTargetOption(
    quotaCommand
      .command("status")
      .description(
        "Inspect every ratified creator quota and optional game-scoped quota",
      )
      .requiredOption("--creator <creator-id>", "Authoritative creator ID")
      .option("--game <game-id>", "Owned game ID for game-scoped quotas")
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "quota-status",
        creatorId: options.creator,
        gameId: options.game,
        json: Boolean(options.json),
      },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    quotaCommand
      .command("check")
      .description(
        "Evaluate one requested amount against authoritative usage, lane mode, and budget state",
      )
      .requiredOption("--key <quota-key>", "Canonical quota key")
      .requiredOption("--lane <lane>", "Semantic production lane")
      .requiredOption("--creator <creator-id>", "Authoritative creator ID")
      .requiredOption(
        "--amount <amount>",
        "Non-negative integer count, bytes, or seconds requested",
      )
      .option("--game <game-id>", "Owned game ID for game-scoped quotas")
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "quota-check",
        key: options.key,
        lane: options.lane,
        creatorId: options.creator,
        gameId: options.game,
        requestedAmount: options.amount,
        json: Boolean(options.json),
      },
      options,
    });
  });

  const jobsCommand = operationsCommand
    .command("jobs")
    .description(
      "Inspect and safely operate the durable platform job authority",
    );

  jobsCommand
    .command("policy")
    .description("Inspect the source-owned policy for every durable job kind")
    .option("--kind <kind>", "Canonical operational job kind")
    .option("--json", "Print the stable machine-readable contract")
    .action(async (options) => {
      await runPlatformDatabaseOperator({
        script: "scripts/production-control-cli.ts",
        operation: {
          command: "jobs-policy",
          kind: options.kind,
          json: Boolean(options.json),
        },
        options,
      });
    });

  addPlatformDatabaseTargetOption(
    jobsCommand
      .command("status")
      .description(
        "Inspect bounded queue, lease, cancellation, and expiry state",
      )
      .option("--kind <kind>", "Canonical operational job kind")
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "jobs-status",
        kind: options.kind,
        json: Boolean(options.json),
      },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    jobsCommand
      .command("list")
      .description("List durable jobs through bounded authority filters")
      .option("--kind <kind>", "Canonical operational job kind")
      .option(
        "--status <status...>",
        "One or more queued, running, cancel_requested, succeeded, failed, or canceled states",
      )
      .option("--creator <creator-id>", "Authoritative creator ID")
      .option("--release <release-id>", "Authoritative release ID")
      .option(
        "--resource-kind <kind>",
        "release_generation or game_media_asset",
      )
      .option("--resource <resource-id>", "Canonical resource ID")
      .option("--limit <limit>", "Maximum jobs to return, from 1 to 500", "100")
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "jobs-list",
        kind: options.kind,
        statuses: options.status,
        creatorId: options.creator,
        releaseId: options.release,
        resourceKind: options.resourceKind,
        resourceId: options.resource,
        limit: options.limit,
        json: Boolean(options.json),
      },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    jobsCommand
      .command("inspect")
      .description("Inspect one job and its ordered persisted lifecycle events")
      .requiredOption("--job <job-id>", "Operational job ID")
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "jobs-inspect",
        jobId: options.job,
        json: Boolean(options.json),
      },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    jobsCommand
      .command("cancel")
      .description(
        "Preview or apply an optimistic, audited durable-job cancellation",
      )
      .requiredOption("--job <job-id>", "Operational job ID")
      .requiredOption(
        "--expected-revision <revision>",
        "Revision returned by jobs inspect",
      )
      .requiredOption("--actor <actor>", "Audited operator identity")
      .requiredOption("--reason <reason>", "Durable operator reason")
      .requiredOption(
        "--idempotency-key <key>",
        "Stable idempotency key for this logical cancellation",
      )
      .option(
        "--apply",
        "Persist the cancellation; omission is a read-only preview",
      )
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "jobs-cancel",
        jobId: options.job,
        expectedRevision: options.expectedRevision,
        actor: options.actor,
        reason: options.reason,
        idempotencyKey: options.idempotencyKey,
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    jobsCommand
      .command("replay")
      .description("Preview or enqueue an audited replay of one terminal job")
      .requiredOption("--job <job-id>", "Terminal operational job ID")
      .requiredOption("--actor <actor>", "Audited operator identity")
      .requiredOption("--reason <reason>", "Durable operator reason")
      .requiredOption(
        "--idempotency-key <key>",
        "Stable idempotency key for this logical replay",
      )
      .option("--apply", "Enqueue the replay; omission is a read-only preview")
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "jobs-replay",
        jobId: options.job,
        actor: options.actor,
        reason: options.reason,
        idempotencyKey: options.idempotencyKey,
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    jobsCommand
      .command("repair-expired")
      .description(
        "Preview or apply bounded recovery of expired deadlines and leases",
      )
      .requiredOption("--kind <kind>", "Canonical operational job kind")
      .requiredOption("--actor <actor>", "Audited operator identity")
      .requiredOption("--reason <reason>", "Durable operator reason")
      .requiredOption(
        "--idempotency-key <key>",
        "Stable idempotency key for this repair operation",
      )
      .option("--limit <limit>", "Maximum jobs to repair, from 1 to 500", "100")
      .option("--apply", "Persist the repair; omission is a read-only preview")
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "jobs-repair-expired",
        kind: options.kind,
        actor: options.actor,
        reason: options.reason,
        idempotencyKey: options.idempotencyKey,
        limit: options.limit,
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    jobsCommand
      .command("cleanup-orphans")
      .description(
        "Preview or delete attempt-scoped output left by terminal release jobs",
      )
      .requiredOption("--actor <actor>", "Audited operator identity")
      .requiredOption("--reason <reason>", "Durable operator reason")
      .option(
        "--limit <limit>",
        "Maximum attempts to clean, from 1 to 500",
        "100",
      )
      .option(
        "--apply",
        "Delete orphan output; omission is a read-only preview",
      )
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "jobs-cleanup-orphans",
        actor: options.actor,
        reason: options.reason,
        limit: options.limit,
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    });
  });

  addPlatformDatabaseTargetOption(
    jobsCommand
      .command("worker-once")
      .description(
        "Preview or execute one durable operational-worker claim and attempt",
      )
      .requiredOption("--kind <kind>", "Canonical operational job kind")
      .requiredOption("--worker <worker-id>", "Stable worker identity")
      .option(
        "--apply",
        "Run one worker cycle; omission is a read-only preview",
      )
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformDatabaseOperator({
      script: "scripts/production-control-cli.ts",
      operation: {
        command: "jobs-worker-once",
        kind: options.kind,
        workerId: options.worker,
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    });
  });

  platformCommand
    .command("db-backup")
    .description("Write a local backup of the platform database")
    .action(() => {
      runRepoPlatformDbBackupCommand();
    });

  return platformCommand;
};
