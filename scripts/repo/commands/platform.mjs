import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertGeneratedContentBlogSourceIsFresh } from "../../content/lib/content-blog-source-generator.mjs";
import { assertGeneratedContentDocsSourceIsFresh } from "../../content/lib/content-docs-source-generator.mjs";
import {
  generatePlatformAiPackArtifacts,
  platformPublicAiPackRoot,
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

const runPlatformGeneratedCheck = async () => {
  runCommand("pnpm", ["--filter", "@air-jam/cli", "ai-pack:check"]);
  await Promise.all([
    assertGeneratedContentDocsSourceIsFresh(),
    assertGeneratedContentBlogSourceIsFresh(),
  ]);

  const tempRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "airjam-platform-ai-pack-check-"),
  );

  try {
    await generatePlatformAiPackArtifacts({ targetRoot: tempRoot });

    if (!fs.existsSync(platformPublicAiPackRoot)) {
      throw new Error(
        'Hosted AI pack artifacts are missing. Run "pnpm run repo -- platform ai-pack generate".',
      );
    }

    const actual = await readRelativeTree(platformPublicAiPackRoot);
    const expected = await readRelativeTree(tempRoot);
    const actualPaths = [...actual.keys()].sort();
    const expectedPaths = [...expected.keys()].sort();

    if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
      throw new Error(
        `Hosted AI pack artifact set is stale.\nExpected: ${expectedPaths.join(", ")}\nActual: ${actualPaths.join(", ")}`,
      );
    }

    for (const relativePath of expectedPaths) {
      if (actual.get(relativePath) !== expected.get(relativePath)) {
        throw new Error(
          `Hosted AI pack artifact is stale: ${relativePath}. Run "pnpm run repo -- platform ai-pack generate".`,
        );
      }
    }

    console.log("✓ Platform generated artifacts are complete and fresh");
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
};

const runPlatformAiPackCheck = async () => {
  const tempRoot = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), "airjam-platform-ai-pack-check-"),
  );

  try {
    await generatePlatformAiPackArtifacts({ targetRoot: tempRoot });

    if (!fs.existsSync(platformPublicAiPackRoot)) {
      throw new Error(
        'Hosted AI pack artifacts are missing. Run "pnpm run repo -- platform ai-pack generate".',
      );
    }

    const actual = await readRelativeTree(platformPublicAiPackRoot);
    const expected = await readRelativeTree(tempRoot);
    const actualPaths = [...actual.keys()].sort();
    const expectedPaths = [...expected.keys()].sort();

    if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
      throw new Error(
        `Hosted AI pack artifact set is stale.\nExpected: ${expectedPaths.join(", ")}\nActual: ${actualPaths.join(", ")}`,
      );
    }

    for (const relativePath of expectedPaths) {
      if (actual.get(relativePath) !== expected.get(relativePath)) {
        throw new Error(
          `Hosted AI pack artifact is stale: ${relativePath}. Run "pnpm run repo -- platform ai-pack generate".`,
        );
      }
    }

    console.log("✓ Hosted platform AI pack artifacts are fresh");
  } finally {
    await fs.promises.rm(tempRoot, { recursive: true, force: true });
  }
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

export const resolveRailwayTelemetryDatabaseUrlWithCli = (
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

export const resolveRailwayTelemetryDatabaseUrl = async (
  { environmentId, projectId },
  {
    createClient = createRailwayApiClient,
    resolveWithCli = resolveRailwayTelemetryDatabaseUrlWithCli,
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

const runPlatformTelemetryOperator = async (operation, options) => {
  const databaseUrl = options.railwayEnvironment
    ? await resolveRailwayTelemetryDatabaseUrl({
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
      "scripts/product-telemetry-cli.ts",
      JSON.stringify(operation),
    ],
    {
      env: databaseUrl ? { DATABASE_URL: databaseUrl } : undefined,
    },
  );
};

const addTelemetryTargetOption = (command) =>
  command
    .option(
      "--railway-environment <id>",
      "Operate an explicit Railway environment without printing its database credentials",
    )
    .option(
      "--railway-project <id>",
      "Railway project id; defaults to RAILWAY_PROJECT_ID",
    );

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
    .description("Verify hosted platform AI pack artifacts are fresh")
    .action(async () => {
      await runPlatformAiPackCheck();
    });

  const telemetryCommand = platformCommand
    .command("telemetry")
    .description(
      "Inspect and operate first-party product telemetry through agent-safe contracts",
    );

  addTelemetryTargetOption(
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
    await runPlatformTelemetryOperator(
      {
        command: "overview",
        days: options.days,
        deploymentEnvironment: options.environment,
        json: Boolean(options.json),
      },
      options,
    );
  });

  addTelemetryTargetOption(
    telemetryCommand
      .command("health")
      .description(
        "Inspect telemetry storage, projection freshness, and retention eligibility",
      )
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformTelemetryOperator(
      {
        command: "health",
        json: Boolean(options.json),
      },
      options,
    );
  });

  addTelemetryTargetOption(
    telemetryCommand
      .command("rebuild")
      .description(
        "Preview or apply a deterministic projection rebuild from retained raw events",
      )
      .option("--apply", "Apply the rebuild; omission is a read-only preview")
      .option("--json", "Print the stable machine-readable contract"),
  ).action(async (options) => {
    await runPlatformTelemetryOperator(
      {
        command: "rebuild",
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    );
  });

  addTelemetryTargetOption(
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
    await runPlatformTelemetryOperator(
      {
        command: "retain",
        apply: Boolean(options.apply),
        json: Boolean(options.json),
      },
      options,
    );
  });

  platformCommand
    .command("db-backup")
    .description("Write a local backup of the platform database")
    .action(() => {
      runRepoPlatformDbBackupCommand();
    });

  return platformCommand;
};
