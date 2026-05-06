import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPECTED_GITHUB_ACTION_SECRETS,
  EXPECTED_PREVIEW_RESOURCE_SECRETS,
  EXPECTED_PREVIEW_RESOURCE_VARIABLE_ALTERNATIVES,
  EXPECTED_PREVIEW_RESOURCE_VARIABLES,
  EXPECTED_RAILWAY_SERVICE_NAMES,
  summarizePreviewReadiness,
} from "../lib/preview-readiness.mjs";

test("preview readiness expectations include control-plane and resource inputs", () => {
  assert.ok(EXPECTED_GITHUB_ACTION_SECRETS.includes("VERCEL_TOKEN"));
  assert.ok(EXPECTED_GITHUB_ACTION_SECRETS.includes("RAILWAY_TOKEN"));
  assert.ok(
    EXPECTED_GITHUB_ACTION_SECRETS.includes(
      "PREVIEW_RELEASES_BROWSER_ACCESS_TOKEN",
    ),
  );
  assert.ok(
    EXPECTED_PREVIEW_RESOURCE_SECRETS.includes("PREVIEW_DATABASE_URL_TEMPLATE"),
  );
  assert.ok(EXPECTED_PREVIEW_RESOURCE_VARIABLES.includes("PREVIEW_R2_BUCKET"));
  assert.deepEqual(EXPECTED_PREVIEW_RESOURCE_VARIABLE_ALTERNATIVES[0], [
    "PREVIEW_R2_ACCOUNT_ID",
    "PREVIEW_R2_ENDPOINT",
  ]);
  assert.ok(
    EXPECTED_RAILWAY_SERVICE_NAMES.includes("air-jam-release-browser-worker"),
  );
});

test("summarizePreviewReadiness produces a readable missing-state summary", () => {
  const summary = summarizePreviewReadiness({
    repo: {
      vercelLink: { projectName: "air-jam" },
      hasServerRailwayConfig: true,
      hasWorkerRailwayConfig: true,
      hasPreviewWorkflow: true,
      hasPreviewDestroyWorkflow: true,
    },
    github: {
      secrets: [],
      variables: [],
      missingSecrets: ["VERCEL_TOKEN", "RAILWAY_TOKEN"],
      missingVariables: ["PREVIEW_BASE_DOMAIN"],
      missingResourceSecrets: ["PREVIEW_DATABASE_URL_TEMPLATE"],
      missingResourceVariables: ["PREVIEW_R2_BUCKET"],
      missingResourceAlternativeGroups: [
        ["PREVIEW_R2_ACCOUNT_ID", "PREVIEW_R2_ENDPOINT"],
      ],
      errors: [],
    },
    vercel: {
      previewEnvStrategy: "dynamic-deploy-env",
      ssoProtectionDeploymentType: "all_except_custom_domains",
      previewProtectionDisabled: false,
      errors: [],
    },
    railway: {
      environmentNames: ["production"],
      serviceNames: ["air-jam-server", "air-jam-release-browser-worker"],
      hasProductionEnvironment: true,
      missingServices: [],
      errors: [],
    },
  });

  assert.match(
    summary,
    /Missing control-plane secrets: VERCEL_TOKEN, RAILWAY_TOKEN/,
  );
  assert.match(
    summary,
    /Missing preview resource secrets: PREVIEW_DATABASE_URL_TEMPLATE/,
  );
  assert.match(
    summary,
    /Missing preview resource variables: PREVIEW_R2_BUCKET/,
  );
  assert.match(
    summary,
    /Missing preview resource alternatives: PREVIEW_R2_ACCOUNT_ID or PREVIEW_R2_ENDPOINT/,
  );
  assert.match(summary, /Has production base environment: yes/);
  assert.match(summary, /Preview env strategy: dynamic-deploy-env/);
  assert.match(summary, /Preview deployment protection disabled: no/);
  assert.match(summary, /Preview deployment protection mode: all_except_custom_domains/);
});
