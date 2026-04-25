import { asc } from "drizzle-orm";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { rebuildRuntimeUsageSessionFromLedger } from "../src/analytics/runtime-usage-rebuilder.js";
import { createServerDatabase, runtimeUsageSessions } from "../src/db.js";
import {
  REMOTE_DATABASE_BLOCKED_MESSAGE,
  resolveServerRuntimeDatabaseUrl,
} from "../src/env/database-url-policy.js";
import { loadWorkspaceEnv } from "../src/env/load-workspace-env.js";

export interface CliOptions {
  help: boolean;
  rebuildAll: boolean;
  runtimeSessionId?: string;
}

export const parseCliArgs = (args: string[]): CliOptions => {
  const options: CliOptions = {
    help: false,
    rebuildAll: false,
  };

  for (const arg of args) {
    if (arg === "--help") {
      options.help = true;
      continue;
    }
    if (arg === "--all") {
      options.rebuildAll = true;
      continue;
    }
    if (arg.startsWith("--session=")) {
      const value = arg.split("=")[1]?.trim();
      if (value) {
        options.runtimeSessionId = value;
      }
      continue;
    }
  }

  return options;
};

export const validateCliOptions = (
  options: CliOptions,
): { ok: true } | { ok: false; message: string } => {
  if (options.help) {
    return { ok: true };
  }

  if (options.rebuildAll && options.runtimeSessionId) {
    return {
      ok: false,
      message: "Choose either --all or --session=<runtimeSessionId>, not both.",
    };
  }

  if (!options.rebuildAll && !options.runtimeSessionId) {
    return {
      ok: false,
      message: "Provide --all or --session=<runtimeSessionId>.",
    };
  }

  return { ok: true };
};

export const formatHelp = (): string => {
  return [
    "Usage: pnpm analytics:rebuild -- --all",
    "   or: pnpm analytics:rebuild -- --session=<runtimeSessionId>",
    "",
    "Rebuilds runtime usage segments and aggregates from the raw analytics ledger.",
    "",
    "Examples:",
    "  pnpm analytics:rebuild -- --all",
    "  pnpm analytics:rebuild -- --session=runtime_123",
  ].join("\n");
};

const resolveTargetSessionIds = async (
  options: CliOptions,
): Promise<string[]> => {
  const databasePolicy = resolveServerRuntimeDatabaseUrl(process.env);
  const db = createServerDatabase(databasePolicy.databaseUrl);
  if (!db) {
    return [];
  }

  if (options.runtimeSessionId) {
    return [options.runtimeSessionId];
  }

  const rows = await db
    .select({ id: runtimeUsageSessions.id })
    .from(runtimeUsageSessions)
    .orderBy(asc(runtimeUsageSessions.startedAt), asc(runtimeUsageSessions.id));

  return rows.map((row) => row.id);
};

async function main(): Promise<void> {
  loadWorkspaceEnv();
  const options = parseCliArgs(process.argv.slice(2));
  const validation = validateCliOptions(options);

  if (options.help) {
    console.log(formatHelp());
    return;
  }

  if (!validation.ok) {
    console.error(validation.message);
    console.error("");
    console.error(formatHelp());
    process.exitCode = 1;
    return;
  }

  const databasePolicy = resolveServerRuntimeDatabaseUrl(process.env);
  const db = createServerDatabase(databasePolicy.databaseUrl);

  if (!db) {
    console.error(
      databasePolicy.remoteDatabaseBlocked
        ? REMOTE_DATABASE_BLOCKED_MESSAGE
        : "DATABASE_URL is required to rebuild runtime usage analytics.",
    );
    process.exitCode = 1;
    return;
  }

  const startedAt = performance.now();
  const referenceTime = new Date();
  const runtimeSessionIds = await resolveTargetSessionIds(options);

  if (runtimeSessionIds.length === 0) {
    console.log("No runtime usage sessions found.");
    return;
  }

  for (const runtimeSessionId of runtimeSessionIds) {
    await rebuildRuntimeUsageSessionFromLedger(
      db,
      runtimeSessionId,
      referenceTime,
    );
    console.log(`recomputed ${runtimeSessionId}`);
  }

  const durationMs = performance.now() - startedAt;
  console.log(
    `rebuild complete: ${runtimeSessionIds.length} session${runtimeSessionIds.length === 1 ? "" : "s"} in ${durationMs.toFixed(0)}ms`,
  );
}

const isExecutedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isExecutedDirectly) {
  void main();
}
