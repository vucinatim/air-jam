import assert from "node:assert/strict";
import test from "node:test";
import { createPreviewOverrideContract } from "../lib/preview-override-contract.mjs";

test("createPreviewOverrideContract derives canonical preview overrides from production topology", () => {
  const contract = createPreviewOverrideContract({
    prNumber: 42,
    branchName: "codex/preview-system",
    commitSha: "abcdef1234567890",
    previewBaseDomain: "preview.airjam.io",
    serverPublicDomain: "air-jam-server-preview-pr-42.up.railway.app",
    workerPublicDomain:
      "air-jam-release-browser-worker-preview-pr-42.up.railway.app",
    env: {
      VERCEL_TOKEN: "vercel",
      RAILWAY_TOKEN: "railway",
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

  assert.equal(contract.manifest.railway.sourceEnvironmentName, "production");
  assert.equal(contract.manifest.railway.environmentName, "preview-pr-42");
  assert.equal(
    contract.runtime.previewAppOrigin,
    "https://full-pr-42.preview.airjam.io",
  );
  assert.equal(
    contract.overrides.platform.env.NEXT_PUBLIC_AIR_JAM_SERVER_URL,
    "https://air-jam-server-preview-pr-42.up.railway.app",
  );
  assert.equal(
    contract.overrides.platform.env.AIRJAM_FULL_STACK_PREVIEW_HOST,
    "full-pr-42.preview.airjam.io",
  );
  assert.equal(
    contract.overrides.platform.env.AIRJAM_RELEASES_BROWSER_WS_ENDPOINT,
    "wss://air-jam-release-browser-worker-preview-pr-42.up.railway.app/ws",
  );
});
