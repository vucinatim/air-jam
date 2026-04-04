import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

type RuntimeUsageDb = PostgresJsDatabase<Record<string, never>>;

export interface AnalyticsTestDbHarness {
  db: RuntimeUsageDb;
  databaseUrl: string;
  dispose: () => Promise<void>;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");
const drizzleDir = path.join(repoRoot, "apps", "platform", "drizzle");
const defaultDatabaseName = "airjam_analytics_test";
const defaultDatabaseUser = "postgres";
const defaultDatabasePassword = "postgres";

const runDocker = (args: string[]): string =>
  execFileSync("docker", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const applyMigrations = async (sqlClient: Sql): Promise<void> => {
  const entries = await fs.readdir(drizzleDir);
  const sqlFiles = entries.filter((entry) => entry.endsWith(".sql")).sort();

  for (const sqlFile of sqlFiles) {
    const filePath = path.join(drizzleDir, sqlFile);
    const raw = await fs.readFile(filePath, "utf8");
    const statements = raw
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await sqlClient.unsafe(statement);
    }
  }
};

const waitForDatabase = async (databaseUrl: string): Promise<Sql> => {
  let lastError: unknown;

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const sqlClient = postgres(databaseUrl, { max: 1, onnotice: () => {} });
    try {
      await sqlClient`select 1`;
      return sqlClient;
    } catch (error) {
      lastError = error;
      await sqlClient.end({ timeout: 1 });
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(
    `Timed out waiting for analytics test Postgres to become ready: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
};

const startDisposableContainer = async (): Promise<{
  databaseUrl: string;
  dispose: () => Promise<void>;
}> => {
  const containerName = `airjam-analytics-test-${crypto.randomUUID()}`;

  try {
    runDocker([
      "run",
      "--rm",
      "-d",
      "--name",
      containerName,
      "-e",
      `POSTGRES_DB=${defaultDatabaseName}`,
      "-e",
      `POSTGRES_USER=${defaultDatabaseUser}`,
      "-e",
      `POSTGRES_PASSWORD=${defaultDatabasePassword}`,
      "-p",
      "127.0.0.1::5432",
      "postgres:17-alpine",
    ]);
  } catch (error) {
    throw new Error(
      'Failed to start disposable analytics test Postgres. Ensure Docker Desktop is running, or set AIR_JAM_ANALYTICS_TEST_DATABASE_URL explicitly.',
      { cause: error },
    );
  }

  let hostPort = "";
  try {
    const portMapping = runDocker(["port", containerName, "5432/tcp"]);
    const parsed = portMapping.match(/:(\d+)\s*$/);
    if (!parsed?.[1]) {
      throw new Error(`Unable to parse Docker port mapping: ${portMapping}`);
    }
    hostPort = parsed[1];
  } catch (error) {
    try {
      runDocker(["rm", "-f", containerName]);
    } catch {
      // Ignore cleanup failure during startup failure.
    }
    throw error;
  }

  return {
    databaseUrl: `postgresql://${defaultDatabaseUser}:${defaultDatabasePassword}@127.0.0.1:${hostPort}/${defaultDatabaseName}`,
    dispose: async () => {
      try {
        runDocker(["rm", "-f", containerName]);
      } catch {
        // Container may already be gone.
      }
    },
  };
};

export const createAnalyticsTestDbHarness =
  async (): Promise<AnalyticsTestDbHarness> => {
    const overrideUrl = process.env.AIR_JAM_ANALYTICS_TEST_DATABASE_URL?.trim();
    const managed = overrideUrl
      ? {
          databaseUrl: overrideUrl,
          dispose: async () => {},
        }
      : await startDisposableContainer();

    const sqlClient = await waitForDatabase(managed.databaseUrl);

    try {
      await applyMigrations(sqlClient);
      return {
        db: drizzle(sqlClient),
        databaseUrl: managed.databaseUrl,
        dispose: async () => {
          await sqlClient.end({ timeout: 5 });
          await managed.dispose();
        },
      };
    } catch (error) {
      await sqlClient.end({ timeout: 5 });
      await managed.dispose();
      throw error;
    }
  };
