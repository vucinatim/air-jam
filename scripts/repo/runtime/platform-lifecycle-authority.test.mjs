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

test("human and machine transports share actor-aware application services", async () => {
  const [releaseRouter, machineRelease, mediaRouter, machineMedia] =
    await Promise.all([
      readRepoSource("apps/platform/src/server/api/routers/release.ts"),
      readRepoSource("apps/platform/src/server/releases/machine-release.ts"),
      readRepoSource("apps/platform/src/server/api/routers/game-media.ts"),
      readRepoSource("apps/platform/src/server/games/machine-game-media.ts"),
    ]);

  for (const source of [releaseRouter, machineRelease]) {
    assert.match(source, /release-application-service/u);
    assert.doesNotMatch(source, /release-artifact-service/u);
    assert.doesNotMatch(source, /release-status-service/u);
    assert.doesNotMatch(source, /assert-owned-release/u);
  }

  for (const source of [mediaRouter, machineMedia]) {
    assert.match(source, /game-media-application-service/u);
    assert.match(source, /game-media-projection/u);
    assert.doesNotMatch(source, /game-media-service["']/u);
    assert.doesNotMatch(source, /assert-owned-game/u);
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

test("live release authority is serialized and database-enforced", async () => {
  const [platformSchema, migration, releaseService, publicRecord] =
    await Promise.all([
      readRepoSource("apps/platform/src/db/schema.ts"),
      readRepoSource(
        "apps/platform/drizzle/0021_one-live-release-invariant.sql",
      ),
      readRepoSource(
        "apps/platform/src/server/releases/release-status-service.ts",
      ),
      readRepoSource(
        "apps/platform/src/server/releases/public-release-record.ts",
      ),
    ]);

  assert.match(platformSchema, /game_releases_one_live_per_game_idx/u);
  assert.match(platformSchema, /where\(sql`\$\{table\.status\} = 'live'`\)/u);
  assert.match(migration, /row_number\(\) OVER/u);
  assert.match(migration, /"live_rank" > 1/u);
  assert.match(migration, /CREATE UNIQUE INDEX/u);
  assert.match(releaseService, /for update/u);
  assert.match(releaseService, /release\.status === "live"/u);
  assert.match(publicRecord, /desc\(gameReleases\.publishedAt\)/u);
});

test("active media is a normalized database-enforced assignment", async () => {
  const [platformSchema, migration, mediaService] = await Promise.all([
    readRepoSource("apps/platform/src/db/schema.ts"),
    readRepoSource("apps/platform/drizzle/0022_media-assignment-integrity.sql"),
    readRepoSource("apps/platform/src/server/media/game-media-service.ts"),
  ]);

  assert.match(platformSchema, /gameMediaAssignments = pgTable/u);
  assert.match(platformSchema, /game_media_assignments_asset_integrity_fk/u);
  assert.match(platformSchema, /game_media_assignments_ready_asset_check/u);
  assert.doesNotMatch(platformSchema, /thumbnail_media_asset_id/u);
  assert.doesNotMatch(platformSchema, /cover_media_asset_id/u);
  assert.doesNotMatch(platformSchema, /preview_video_media_asset_id/u);
  assert.doesNotMatch(mediaService, /getGameMediaSlotColumn/u);

  const targetIndex = migration.indexOf(
    'CREATE UNIQUE INDEX "game_media_assets_assignment_target_idx"',
  );
  const integrityConstraint = migration.indexOf(
    'ADD CONSTRAINT "game_media_assignments_asset_integrity_fk"',
  );
  const dataMigration = migration.indexOf(
    'INSERT INTO "game_media_assignments"',
  );
  const oldColumnRemoval = migration.indexOf(
    'DROP COLUMN "thumbnail_media_asset_id"',
  );

  assert.ok(targetIndex >= 0);
  assert.ok(integrityConstraint > targetIndex);
  assert.ok(dataMigration > integrityConstraint);
  assert.ok(oldColumnRemoval > dataMigration);
});
