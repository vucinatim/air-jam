import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "../lib/paths.mjs";
import { runCommandResult } from "../lib/shell.mjs";

const composeFile = path.join(repoRoot, "docker-compose.dev.yml");
const dataDir = path.join(repoRoot, ".airjam", "postgres", "dev");

const devDbConfig = () => ({
  host: process.env.AIR_JAM_DEV_POSTGRES_HOST ?? "127.0.0.1",
  port: process.env.AIR_JAM_DEV_POSTGRES_PORT ?? "55432",
  database: process.env.AIR_JAM_DEV_POSTGRES_DB ?? "airjam",
  user: process.env.AIR_JAM_DEV_POSTGRES_USER ?? "postgres",
  password: process.env.AIR_JAM_DEV_POSTGRES_PASSWORD ?? "postgres",
});

const dockerComposeArgs = (...args) => ["compose", "-f", composeFile, ...args];

const composeEnv = () => ({
  UID: process.env.UID ?? String(os.userInfo().uid),
  GID: process.env.GID ?? String(os.userInfo().gid),
  AIR_JAM_DEV_POSTGRES_PORT: devDbConfig().port,
  AIR_JAM_DEV_POSTGRES_DB: devDbConfig().database,
  AIR_JAM_DEV_POSTGRES_USER: devDbConfig().user,
  AIR_JAM_DEV_POSTGRES_PASSWORD: devDbConfig().password,
});

const ensureDataDir = () => {
  fs.mkdirSync(dataDir, { recursive: true });
};

const buildDatabaseUrl = () => {
  const config = devDbConfig();
  return `postgresql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@${config.host}:${config.port}/${config.database}`;
};

const runDockerCompose = (args, options = {}) =>
  runCommandResult("docker", dockerComposeArgs(...args), {
    ...options,
    env: {
      ...composeEnv(),
      ...(options.env ?? {}),
    },
  });

const assertDockerSucceeded = (result, failureMessage) => {
  if (result.status !== 0) {
    throw new Error(failureMessage);
  }
};

const waitForPostgres = async ({ quiet = false, timeoutMs = 30_000 } = {}) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = runDockerCompose(
      [
        "exec",
        "-T",
        "postgres",
        "pg_isready",
        "-U",
        devDbConfig().user,
        "-d",
        devDbConfig().database,
      ],
      { stdio: quiet ? "pipe" : "ignore" },
    );
    if (result.status === 0) {
      if (!quiet) {
        console.log("✓ Local dev Postgres is ready");
      }
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(
    "Timed out waiting for local dev Postgres to become ready. Check `docker compose logs postgres`.",
  );
};

export const registerDbCommands = (program) => {
  const dbCommand = program
    .command("db")
    .description("Repo-owned local dev Postgres helpers");

  dbCommand
    .command("up")
    .description(
      "Start the local dev Postgres container and wait until it is ready",
    )
    .action(async () => {
      ensureDataDir();
      const result = runDockerCompose(["up", "-d", "postgres"]);
      assertDockerSucceeded(
        result,
        "Failed to start local dev Postgres. Ensure Docker Desktop is running.",
      );
      await waitForPostgres();
      console.log(`→ DATABASE_URL=${buildDatabaseUrl()}`);
    });

  dbCommand
    .command("down")
    .description("Stop the local dev Postgres container")
    .action(() => {
      const result = runDockerCompose(["down"]);
      assertDockerSucceeded(result, "Failed to stop local dev Postgres.");
      console.log("✓ Local dev Postgres stopped");
    });

  dbCommand
    .command("wait")
    .description("Wait until the local dev Postgres container is ready")
    .action(async () => {
      await waitForPostgres();
    });

  dbCommand
    .command("reset")
    .description(
      "Stop local dev Postgres and remove the persistent local data directory",
    )
    .action(() => {
      runDockerCompose(["down"], { stdio: "ignore" });
      fs.rmSync(dataDir, { recursive: true, force: true });
      console.log(
        `✓ Reset local dev Postgres data at ${path.relative(repoRoot, dataDir)}`,
      );
    });

  dbCommand
    .command("url")
    .description("Print the local dev Postgres DATABASE_URL")
    .action(() => {
      console.log(buildDatabaseUrl());
    });

  return dbCommand;
};
