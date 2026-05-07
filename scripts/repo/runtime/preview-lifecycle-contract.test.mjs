import assert from "node:assert/strict";
import test from "node:test";
import { bringPreviewUp, tearPreviewDown } from "../lib/preview-lifecycle.mjs";

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

test("bringPreviewUp dry-run orchestrates the canonical full-stack flow", async () => {
  const result = await bringPreviewUp({
    prNumber: 42,
    branchName: "codex/preview-system",
    commitSha: "abcdef1234567890",
    env: previewEnv,
    apply: false,
  });

  assert.equal(result.previewId, "pr-42");
  assert.equal(result.railwayPrepare.environmentName, "preview-pr-42");
  assert.equal(result.databasePrepare.schemaName, "preview_pr_42");
  assert.equal(result.runtime.previewHost, "pr-42.preview.airjam.io");
  assert.equal(result.ready, true);
  assert.match(result.platformDeploy.actions[0], /would deploy platform preview pr-42/);
});

test("tearPreviewDown dry-run orchestrates the canonical cleanup flow", async () => {
  const result = await tearPreviewDown({
    prNumber: 42,
    branchName: "codex/preview-system",
    commitSha: "abcdef1234567890",
    env: previewEnv,
    apply: false,
  });

  assert.equal(result.previewId, "pr-42");
  assert.match(result.platformDestroy.actions[0], /would remove alias pr-42.preview.airjam.io/);
  assert.match(result.databaseDestroy.actions[0], /would drop schema preview_pr_42 cascade/);
  assert.match(result.railwayDestroy.actions[0], /would delete environment preview-pr-42/);
});
