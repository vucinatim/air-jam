import assert from "node:assert/strict";
import test from "node:test";
import {
  destroyPreviewDatabase,
  preparePreviewDatabase,
} from "../lib/preview-database.mjs";

const previewEnv = {
  PREVIEW_BASE_DOMAIN: "preview.airjam.io",
  VERCEL_TOKEN: "vercel",
  RAILWAY_TOKEN: "railway",
  PREVIEW_AIR_JAM_APP_ID: "preview-app",
  RAILWAY_PROJECT_ID: "railway-project",
  PREVIEW_AIR_JAM_MASTER_KEY: "master",
  PREVIEW_BETTER_AUTH_SECRET: "better-auth",
  PREVIEW_RELEASES_INTERNAL_ACCESS_TOKEN: "internal-token",
  PREVIEW_RELEASES_BROWSER_ACCESS_TOKEN: "browser-token",
  PREVIEW_DATABASE_URL_TEMPLATE:
    "postgres://db/railway?options=--search_path%3D{{schemaName}}",
  PREVIEW_R2_BUCKET: "preview-bucket",
  PREVIEW_R2_ACCOUNT_ID: "account-id",
  PREVIEW_R2_ACCESS_KEY_ID: "access-key",
  PREVIEW_R2_SECRET_ACCESS_KEY: "secret-key",
};

test("preparePreviewDatabase dry-run uses canonical schema name", async () => {
  const result = await preparePreviewDatabase({
    prNumber: 42,
    branchName: "codex/preview-system",
    commitSha: "abcdef1234567890",
    env: previewEnv,
    apply: false,
  });

  assert.equal(result.schemaName, "preview_pr_42");
  assert.deepEqual(result.missingInputs, []);
  assert.match(result.actions[0], /would create schema preview_pr_42/);
});

test("destroyPreviewDatabase dry-run uses canonical schema name", async () => {
  const result = await destroyPreviewDatabase({
    prNumber: 42,
    branchName: "codex/preview-system",
    commitSha: "abcdef1234567890",
    env: previewEnv,
    apply: false,
  });

  assert.equal(result.schemaName, "preview_pr_42");
  assert.deepEqual(result.missingInputs, []);
  assert.match(result.actions[0], /would drop schema preview_pr_42 cascade/);
});
