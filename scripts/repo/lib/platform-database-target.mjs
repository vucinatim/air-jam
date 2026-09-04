import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.mjs";
import { createRailwayApiClient } from "./railway-api.mjs";
import { runCommandResult } from "./shell.mjs";

const parseDotenvValue = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const readDatabaseUrl = (filePath) => {
  if (!fs.existsSync(filePath)) return null;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*(.+?)\s*$/u);
    if (match) return parseDotenvValue(match[1]);
  }
  return null;
};

const isLoopbackDatabaseUrl = (databaseUrl) => {
  const hostname = new URL(databaseUrl).hostname;
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);
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

export const resolveRailwayPlatformDatabaseTargetWithCli = (
  { environmentId, projectId },
  readRailwayJson = runRailwayJson,
) => {
  if (!projectId) {
    throw new Error(
      "A Railway project ID is required when project-token access cannot inspect the environment.",
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
  const service = services.find(
    (candidate) =>
      candidate.name?.toLowerCase().includes("postgres") ||
      candidate.source?.image?.toLowerCase().includes("postgres"),
  );
  if (!service) {
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
      service.id,
      "--json",
    ],
    "database credential resolution",
  );
  const databaseUrl = variables.DATABASE_PUBLIC_URL ?? variables.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      `PostgreSQL in Railway environment ${environmentId} has no database URL.`,
    );
  }
  return {
    databaseUrl,
    target: {
      kind: "railway",
      projectId,
      environmentId,
      environmentName: null,
      databaseServiceId: service.id,
      databaseServiceName: service.name ?? null,
    },
  };
};

export const resolveRailwayPlatformDatabaseTarget = async (
  { environmentId, projectId },
  {
    createClient = createRailwayApiClient,
    resolveWithCli = resolveRailwayPlatformDatabaseTargetWithCli,
  } = {},
) => {
  try {
    const client = createClient();
    const environment = await client.getEnvironment(environmentId);
    for (const service of environment.serviceInstances.filter(
      (instance) => !instance.railwayConfigFile,
    )) {
      const variables = await client.getVariables({
        projectId: environment.projectId,
        environmentId: environment.id,
        serviceId: service.serviceId,
      });
      const databaseUrl =
        variables.DATABASE_PUBLIC_URL ?? variables.DATABASE_URL;
      if (databaseUrl) {
        return {
          databaseUrl,
          target: {
            kind: "railway",
            projectId: environment.projectId,
            environmentId: environment.id,
            environmentName: environment.name,
            databaseServiceId: service.serviceId,
            databaseServiceName: service.serviceName ?? null,
          },
        };
      }
    }
  } catch {
    // A bounded authenticated-CLI fallback supports accounts where project
    // tokens cannot inspect ephemeral or separately owned environments.
  }
  return resolveWithCli({
    environmentId,
    projectId: projectId ?? process.env.RAILWAY_PROJECT_ID ?? null,
  });
};

export const resolvePlatformDatabaseTarget = async ({
  railwayEnvironment,
  railwayProject,
} = {}) => {
  if (railwayEnvironment) {
    return resolveRailwayPlatformDatabaseTarget({
      environmentId: railwayEnvironment,
      projectId: railwayProject ?? null,
    });
  }
  const databaseUrl =
    process.env.DATABASE_URL ??
    readDatabaseUrl(path.join(repoRoot, "apps/platform/.env.local")) ??
    readDatabaseUrl(path.join(repoRoot, "apps/platform/.env"));
  if (!databaseUrl) {
    throw new Error(
      "No DATABASE_URL found. Set it in the environment or apps/platform/.env.local.",
    );
  }
  const isLoopback = isLoopbackDatabaseUrl(databaseUrl);
  return {
    databaseUrl,
    target: {
      kind: isLoopback ? "local" : "unclassified",
      projectId: null,
      environmentId: null,
      environmentName: isLoopback ? "local" : null,
      databaseServiceId: null,
      databaseServiceName: null,
    },
  };
};
