import assert from "node:assert/strict";
import test from "node:test";
import { sweepPreviews } from "../lib/preview-sweep.mjs";

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

test("sweepPreviews dry-run reports no orphan previews when nothing is discovered", async () => {
  const result = await sweepPreviews({
    openPrNumbers: [4, 7],
    env: previewEnv,
    apply: false,
    discovery: {
      railwayEnvironmentNames: [],
      databaseSchemas: [],
      vercelDeployments: [],
      vercelAliases: [],
    },
  });

  assert.deepEqual(result.openPrNumbers, [4, 7]);
  assert.deepEqual(result.discoveredPreviewPrNumbers, []);
  assert.deepEqual(result.orphanPreviewPrNumbers, []);
  assert.deepEqual(result.actions, []);
  assert.deepEqual(result.results, []);
});
