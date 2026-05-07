import assert from "node:assert/strict";
import test from "node:test";
import {
  PREVIEW_CONTROL_PLANE_SECRET_NAMES,
  PREVIEW_RESOURCE_SECRET_NAMES,
  PREVIEW_RESOURCE_VARIABLE_ALTERNATIVES,
  loadPreviewControlPlane,
  renderPreviewTemplate,
  resolvePreviewGithubConfigReadiness,
} from "../lib/preview-control-plane.mjs";

test("preview github readiness separates control-plane inputs from resource inputs", () => {
  const readiness = resolvePreviewGithubConfigReadiness({
    secretNames: PREVIEW_CONTROL_PLANE_SECRET_NAMES,
    variableNames: [
      "PREVIEW_BASE_DOMAIN",
      "PREVIEW_AIR_JAM_APP_ID",
      "RAILWAY_PROJECT_ID",
    ],
  });

  assert.deepEqual(readiness.missingControlPlaneSecrets, []);
  assert.deepEqual(readiness.missingControlPlaneVariables, []);
  assert.deepEqual(
    readiness.missingResourceSecrets,
    PREVIEW_RESOURCE_SECRET_NAMES,
  );
  assert.deepEqual(
    readiness.missingResourceAlternativeGroups[0],
    PREVIEW_RESOURCE_VARIABLE_ALTERNATIVES[0],
  );
});

test("renderPreviewTemplate replaces stable preview placeholders", () => {
  const rendered = renderPreviewTemplate(
    "postgres://db/{{previewId}}?pr={{prNumber}}&branch={{branchSlug}}&schema={{schemaName}}&host={{previewHost}}",
    {
      previewId: "pr-42",
      prNumber: 42,
      database: {
        schemaName: "preview_pr_42",
      },
      vercel: {
        previewHost: "full-pr-42.preview.airjam.io",
      },
      git: {
        branchSlug: "codex-preview-system",
      },
    },
  );

  assert.equal(
    rendered,
    "postgres://db/pr-42?pr=42&branch=codex-preview-system&schema=preview_pr_42&host=full-pr-42.preview.airjam.io",
  );
});

test("renderPreviewTemplate supports the legacy PR placeholder", () => {
  const rendered = renderPreviewTemplate("schema=preview_pr___PR_NUMBER__", {
    previewId: "pr-42",
    prNumber: 42,
    database: {
      schemaName: "preview_pr_42",
    },
    vercel: {
      previewHost: "full-pr-42.preview.airjam.io",
    },
    git: {
      branchSlug: "codex-preview-system",
    },
  });

  assert.equal(rendered, "schema=preview_pr_42");
});

test("loadPreviewControlPlane reports resource blockers separately", () => {
  const state = loadPreviewControlPlane(
    {
      PREVIEW_BASE_DOMAIN: "preview.airjam.io",
      VERCEL_TOKEN: "vercel",
      RAILWAY_TOKEN: "railway",
      PREVIEW_AIR_JAM_APP_ID: "preview-app",
      RAILWAY_PROJECT_ID: "railway-project",
      PREVIEW_AIR_JAM_MASTER_KEY: "master",
      PREVIEW_BETTER_AUTH_SECRET: "better-auth",
      PREVIEW_RELEASES_INTERNAL_ACCESS_TOKEN: "internal-token",
      PREVIEW_RELEASES_BROWSER_ACCESS_TOKEN: "browser-token",
    },
    {
      manifest: {
        previewId: "pr-42",
        prNumber: 42,
        git: { branchSlug: "codex-preview-system" },
      },
    },
  );

  assert.deepEqual(state.missingCoreInputs, []);
  assert.ok(
    state.missingResourceInputs.includes("PREVIEW_DATABASE_URL_TEMPLATE"),
  );
  assert.ok(state.missingResourceInputs.includes("PREVIEW_R2_BUCKET"));
});

test("loadPreviewControlPlane requires the preview base domain", () => {
  const state = loadPreviewControlPlane({
    VERCEL_TOKEN: "vercel",
    RAILWAY_TOKEN: "railway",
    PREVIEW_AIR_JAM_APP_ID: "preview-app",
    RAILWAY_PROJECT_ID: "railway-project",
    PREVIEW_AIR_JAM_MASTER_KEY: "master",
    PREVIEW_BETTER_AUTH_SECRET: "better-auth",
    PREVIEW_RELEASES_INTERNAL_ACCESS_TOKEN: "internal-token",
    PREVIEW_RELEASES_BROWSER_ACCESS_TOKEN: "browser-token",
  });

  assert.ok(state.missingCoreInputs.includes("PREVIEW_BASE_DOMAIN"));
});
