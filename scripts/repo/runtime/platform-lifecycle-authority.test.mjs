import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readRepoSource = (path) =>
  readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

test("creator transports expose semantic lifecycle operations only", async () => {
  const [releaseRouter, mediaRouter] = await Promise.all([
    readRepoSource("apps/platform/src/server/api/routers/release.ts"),
    readRepoSource("apps/platform/src/server/api/routers/game-media.ts"),
  ]);

  assert.doesNotMatch(releaseRouter, /\bupdateStatus\s*:/u);
  assert.doesNotMatch(mediaRouter, /\bupdateStatus\s*:/u);

  for (const operation of ["finalizeUpload", "publish", "archive"]) {
    assert.match(releaseRouter, new RegExp(`\\b${operation}\\s*:`));
  }

  for (const operation of ["finalizeUpload", "assignAsset", "archiveAsset"]) {
    assert.match(mediaRouter, new RegExp(`\\b${operation}\\s*:`));
  }
});

test("platform and server import one shared runtime database contract", async () => {
  const [platformSchema, serverDatabase, sharedContract] = await Promise.all([
    readRepoSource("apps/platform/src/db/schema.ts"),
    readRepoSource("packages/server/src/db.ts"),
    readRepoSource("packages/database-contract/src/index.ts"),
  ]);

  for (const source of [platformSchema, serverDatabase]) {
    assert.match(source, /@air-jam\/database-contract/u);
    assert.doesNotMatch(source, /pgTable\("runtime_usage_/u);
  }

  for (const tableName of [
    "app_ids",
    "runtime_usage_sessions",
    "runtime_usage_events",
    "runtime_usage_controller_segments",
    "runtime_usage_game_segments",
    "runtime_usage_eligible_segments",
    "runtime_usage_game_session_metrics",
    "runtime_usage_daily_game_metrics",
  ]) {
    assert.equal(
      sharedContract.match(new RegExp(`pgTable\\(\\s*"${tableName}"`, "gu"))
        ?.length,
      1,
      `${tableName} must have one shared declaration`,
    );
  }
});
