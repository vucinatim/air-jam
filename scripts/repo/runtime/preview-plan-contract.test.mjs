import assert from "node:assert/strict";
import test from "node:test";
import { createPreviewPlan } from "../lib/preview-plan.mjs";

test("createPreviewPlan redacts sensitive env values and surfaces runtime blockers", () => {
  const plan = createPreviewPlan({
    prNumber: 42,
    branchName: "codex/preview-system",
    commitSha: "abcdef1234567890",
    previewBaseDomain: "preview.airjam.io",
    serverPublicDomain: "air-jam-server-preview-pr-42.up.railway.app",
    workerPublicDomain: "air-jam-release-browser-worker-preview-pr-42.up.railway.app",
    env: {
      VERCEL_TOKEN: "vercel",
      RAILWAY_TOKEN: "railway",
      PREVIEW_BASE_DOMAIN: "preview.airjam.io",
      PREVIEW_AIR_JAM_APP_ID: "preview-app",
      RAILWAY_PROJECT_ID: "railway-project",
      PREVIEW_AIR_JAM_MASTER_KEY: "master",
      PREVIEW_BETTER_AUTH_SECRET: "better-auth",
      PREVIEW_RELEASES_INTERNAL_ACCESS_TOKEN: "internal-token",
      PREVIEW_RELEASES_BROWSER_ACCESS_TOKEN: "browser-token",
      PREVIEW_DATABASE_URL_TEMPLATE:
        "postgres://db/{{previewId}}?branch={{branchSlug}}",
      PREVIEW_R2_BUCKET: "preview-bucket",
      PREVIEW_R2_ACCOUNT_ID: "account-id",
      PREVIEW_R2_ACCESS_KEY_ID: "access-key",
      PREVIEW_R2_SECRET_ACCESS_KEY: "secret-key",
    },
  });

  assert.equal(plan.readiness.canProvisionRailway, true);
  assert.equal(plan.readiness.canDeployFullStack, true);
  assert.equal(plan.railway.environmentName, "preview-pr-42");
  assert.equal(plan.railway.sourceEnvironmentName, "production");

  const databaseEntry = plan.railway.serverEnv.find(
    (entry) => entry.name === "DATABASE_URL",
  );
  assert.equal(databaseEntry.valuePreview, "[configured]");

  const publicEntry = plan.platform.env.find(
    (entry) => entry.name === "NEXT_PUBLIC_AIR_JAM_APP_ID",
  );
  assert.equal(publicEntry.valuePreview, "preview-app");

  const serverUrlEntry = plan.platform.env.find(
    (entry) => entry.name === "NEXT_PUBLIC_AIR_JAM_SERVER_URL",
  );
  assert.equal(
    serverUrlEntry.valuePreview,
    "https://air-jam-server-preview-pr-42.up.railway.app",
  );
});
