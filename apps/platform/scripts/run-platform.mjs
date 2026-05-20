#!/usr/bin/env node
/**
 * Runtime entry point for the platform container.
 *
 * On Railway PR preview environments only, applies drizzle migrations
 * against the ephemeral Postgres before handing off to the Next.js
 * standalone server. Production is migration-managed manually (see
 * docs/guides/railway-deployment-guide.md) so this script is a no-op
 * outside previews.
 *
 * Layout assumption: this file is shipped into the runtime image at
 *   /app/apps/platform/run-platform.mjs
 * alongside
 *   /app/apps/platform/server.js          (Next.js standalone entry)
 *   /app/apps/platform/drizzle/           (migration SQL files)
 *
 * railway.json's startCommand points at this file. The Dockerfile
 * runtime stage copies both the standalone tree and the drizzle/
 * folder so the paths above resolve.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

const railwayEnvironmentName = process.env.RAILWAY_ENVIRONMENT_NAME?.trim();
const isRailwayPreviewEnvironment =
  Boolean(railwayEnvironmentName) && railwayEnvironmentName !== "production";

const log = (...args) => console.log("[run-platform]", ...args);

if (isRailwayPreviewEnvironment) {
  if (!process.env.DATABASE_URL?.trim()) {
    console.error(
      "[run-platform] DATABASE_URL is not set on preview environment",
      `"${railwayEnvironmentName}"; cannot run migrations.`,
    );
    process.exit(1);
  }

  log(`Running drizzle migrations against preview env "${railwayEnvironmentName}"...`);

  // Dynamic imports keep production cold-start fast — the migrator
  // module and its dependencies aren't loaded outside previews.
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { migrate } = await import("drizzle-orm/postgres-js/migrator");
  const postgres = (await import("postgres")).default;

  const migrationsFolder = path.resolve(here, "drizzle");
  const sql = postgres(process.env.DATABASE_URL, { max: 1 });
  try {
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder });
    log("Drizzle migrations complete.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Hand off to the Next.js standalone server. server.js auto-binds the
// configured port on import — no explicit boot call needed.
await import(path.resolve(here, "server.js"));
