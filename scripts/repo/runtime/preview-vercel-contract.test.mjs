import assert from "node:assert/strict";
import test from "node:test";
import {
  deployPreviewPlatform,
  destroyPreviewPlatform,
} from "../lib/preview-vercel.mjs";

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

test("deployPreviewPlatform dry-run produces canonical alias target", () => {
  const result = deployPreviewPlatform({
    prNumber: 42,
    branchName: "codex/preview-system",
    commitSha: "abcdef1234567890",
    serverPublicDomain: "air-jam-server-preview-pr-42.up.railway.app",
    workerPublicDomain:
      "air-jam-release-browser-worker-preview-pr-42.up.railway.app",
    env: previewEnv,
    apply: false,
  });

  assert.equal(result.previewHost, "full-pr-42.preview.airjam.io");
  assert.deepEqual(result.missingInputs, []);
  assert.equal(result.deploymentReady, true);
  assert.match(result.actions[0], /would deploy platform preview pr-42/);
  assert.match(
    result.actions[1],
    /would alias deployment to full-pr-42.preview.airjam.io/,
  );
  assert.match(
    result.actions[2],
    /would remove legacy alias pr-42.preview.airjam.io if present/,
  );
});

test("destroyPreviewPlatform dry-run targets preview-tagged deployments", () => {
  const result = destroyPreviewPlatform({
    prNumber: 42,
    branchName: "codex/preview-system",
    commitSha: "abcdef1234567890",
    env: previewEnv,
    apply: false,
  });

  assert.deepEqual(result.missingInputs, []);
  assert.match(
    result.actions[0],
    /would remove alias full-pr-42.preview.airjam.io/,
  );
  assert.match(result.actions[1], /would remove alias pr-42.preview.airjam.io/);
  assert.match(result.actions[2], /would remove deployments tagged pr-42/);
});
