const trimToUndefined = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

export const PREVIEW_CONTROL_PLANE_SECRET_NAMES = [
  "VERCEL_TOKEN",
  "RAILWAY_TOKEN",
  "PREVIEW_AIR_JAM_MASTER_KEY",
  "PREVIEW_BETTER_AUTH_SECRET",
  "PREVIEW_RELEASES_INTERNAL_ACCESS_TOKEN",
  "PREVIEW_RELEASES_BROWSER_ACCESS_TOKEN",
];

export const PREVIEW_CONTROL_PLANE_VARIABLE_NAMES = [
  "PREVIEW_BASE_DOMAIN",
  "PREVIEW_AIR_JAM_APP_ID",
  "RAILWAY_PROJECT_ID",
];

export const PREVIEW_RESOURCE_SECRET_NAMES = [
  "PREVIEW_DATABASE_URL_TEMPLATE",
  "PREVIEW_R2_ACCESS_KEY_ID",
  "PREVIEW_R2_SECRET_ACCESS_KEY",
];

export const PREVIEW_RESOURCE_VARIABLE_NAMES = ["PREVIEW_R2_BUCKET"];

export const PREVIEW_RESOURCE_VARIABLE_ALTERNATIVES = [
  ["PREVIEW_R2_ACCOUNT_ID", "PREVIEW_R2_ENDPOINT"],
];

export const renderPreviewTemplate = (template, manifest) => {
  const value = trimToUndefined(template);
  if (!value) {
    return null;
  }

  return value
    .replaceAll("preview_pr___PR_NUMBER__", manifest.database.schemaName)
    .replaceAll("{{previewId}}", manifest.previewId)
    .replaceAll("{{prNumber}}", String(manifest.prNumber))
    .replaceAll("{{branchSlug}}", manifest.git.branchSlug)
    .replaceAll("{{schemaName}}", manifest.database.schemaName)
    .replaceAll("{{previewHost}}", manifest.vercel.previewHost ?? "")
    .replaceAll("___PR_NUMBER__", String(manifest.prNumber));
};

export const resolvePreviewGithubConfigReadiness = ({
  secretNames,
  variableNames,
}) => {
  const secretSet = new Set(secretNames);
  const variableSet = new Set(variableNames);

  return {
    missingControlPlaneSecrets: PREVIEW_CONTROL_PLANE_SECRET_NAMES.filter(
      (name) => !secretSet.has(name),
    ),
    missingControlPlaneVariables: PREVIEW_CONTROL_PLANE_VARIABLE_NAMES.filter(
      (name) => !variableSet.has(name),
    ),
    missingResourceSecrets: PREVIEW_RESOURCE_SECRET_NAMES.filter(
      (name) => !secretSet.has(name),
    ),
    missingResourceVariables: PREVIEW_RESOURCE_VARIABLE_NAMES.filter(
      (name) => !variableSet.has(name),
    ),
    missingResourceAlternativeGroups:
      PREVIEW_RESOURCE_VARIABLE_ALTERNATIVES.filter(
        (alternatives) => !alternatives.some((name) => variableSet.has(name)),
      ),
  };
};

export const loadPreviewControlPlane = (
  env = process.env,
  { manifest } = {},
) => {
  const controlPlane = {
    vercelToken: trimToUndefined(env.VERCEL_TOKEN) ?? null,
    railwayToken: trimToUndefined(env.RAILWAY_TOKEN) ?? null,
    previewBaseDomain: trimToUndefined(env.PREVIEW_BASE_DOMAIN) ?? null,
    previewAppId: trimToUndefined(env.PREVIEW_AIR_JAM_APP_ID) ?? null,
    railwayProjectId: trimToUndefined(env.RAILWAY_PROJECT_ID) ?? null,
    previewMasterKey: trimToUndefined(env.PREVIEW_AIR_JAM_MASTER_KEY) ?? null,
    betterAuthSecret: trimToUndefined(env.PREVIEW_BETTER_AUTH_SECRET) ?? null,
    releasesInternalAccessToken:
      trimToUndefined(env.PREVIEW_RELEASES_INTERNAL_ACCESS_TOKEN) ?? null,
    releasesBrowserAccessToken:
      trimToUndefined(env.PREVIEW_RELEASES_BROWSER_ACCESS_TOKEN) ?? null,
    databaseUrlTemplate:
      trimToUndefined(env.PREVIEW_DATABASE_URL_TEMPLATE) ?? null,
    r2Bucket: trimToUndefined(env.PREVIEW_R2_BUCKET) ?? null,
    r2AccountId: trimToUndefined(env.PREVIEW_R2_ACCOUNT_ID) ?? null,
    r2Endpoint: trimToUndefined(env.PREVIEW_R2_ENDPOINT) ?? null,
    r2AccessKeyId: trimToUndefined(env.PREVIEW_R2_ACCESS_KEY_ID) ?? null,
    r2SecretAccessKey:
      trimToUndefined(env.PREVIEW_R2_SECRET_ACCESS_KEY) ?? null,
  };

  const missingCoreInputs = [];
  if (!controlPlane.vercelToken) {
    missingCoreInputs.push("VERCEL_TOKEN");
  }
  if (!controlPlane.railwayToken) {
    missingCoreInputs.push("RAILWAY_TOKEN");
  }
  if (!controlPlane.previewBaseDomain) {
    missingCoreInputs.push("PREVIEW_BASE_DOMAIN");
  }
  if (!controlPlane.previewAppId) {
    missingCoreInputs.push("PREVIEW_AIR_JAM_APP_ID");
  }
  if (!controlPlane.railwayProjectId) {
    missingCoreInputs.push("RAILWAY_PROJECT_ID");
  }
  if (!controlPlane.previewMasterKey) {
    missingCoreInputs.push("PREVIEW_AIR_JAM_MASTER_KEY");
  }
  if (!controlPlane.betterAuthSecret) {
    missingCoreInputs.push("PREVIEW_BETTER_AUTH_SECRET");
  }
  if (!controlPlane.releasesInternalAccessToken) {
    missingCoreInputs.push("PREVIEW_RELEASES_INTERNAL_ACCESS_TOKEN");
  }
  if (!controlPlane.releasesBrowserAccessToken) {
    missingCoreInputs.push("PREVIEW_RELEASES_BROWSER_ACCESS_TOKEN");
  }

  const missingResourceInputs = [];
  if (!controlPlane.databaseUrlTemplate) {
    missingResourceInputs.push("PREVIEW_DATABASE_URL_TEMPLATE");
  }
  if (!controlPlane.r2Bucket) {
    missingResourceInputs.push("PREVIEW_R2_BUCKET");
  }
  if (!controlPlane.r2AccessKeyId) {
    missingResourceInputs.push("PREVIEW_R2_ACCESS_KEY_ID");
  }
  if (!controlPlane.r2SecretAccessKey) {
    missingResourceInputs.push("PREVIEW_R2_SECRET_ACCESS_KEY");
  }
  if (!controlPlane.r2AccountId && !controlPlane.r2Endpoint) {
    missingResourceInputs.push("PREVIEW_R2_ACCOUNT_ID or PREVIEW_R2_ENDPOINT");
  }

  return {
    controlPlane,
    rendered: {
      databaseUrl:
        manifest && controlPlane.databaseUrlTemplate
          ? renderPreviewTemplate(controlPlane.databaseUrlTemplate, manifest)
          : null,
    },
    missingCoreInputs,
    missingResourceInputs,
    hasCompleteCoreInputs: missingCoreInputs.length === 0,
    hasCompleteResourceInputs: missingResourceInputs.length === 0,
  };
};
