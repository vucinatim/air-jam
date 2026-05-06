import { createPreviewOverrideContract } from "./preview-override-contract.mjs";

const isSensitiveEnvKey = (key) =>
  /(SECRET|TOKEN|KEY|DATABASE_URL)/.test(key) || key === "BETTER_AUTH_SECRET";

const redactEnvEntries = (envMap) =>
  Object.entries(envMap).map(([name, value]) => ({
    name,
    configured: value != null,
    sensitive: isSensitiveEnvKey(name),
    valuePreview:
      value == null ? null : isSensitiveEnvKey(name) ? "[configured]" : value,
  }));

export const createPreviewPlan = ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  serverPublicDomain = null,
  workerPublicDomain = null,
  env = process.env,
} = {}) => {
  const preview = createPreviewOverrideContract({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain,
    serverPublicDomain,
    workerPublicDomain,
    env,
  });
  const { manifest, controlPlaneState } = preview;
  const serverEnv =
    preview.overrides.railway.services[manifest.railway.services.server];
  const workerEnv =
    preview.overrides.railway.services[
      manifest.railway.services.browserWorker
    ];
  const platformEnv = preview.overrides.platform.env;

  const missingRuntimeInputs = [];
  if (!preview.runtime.serverPublicUrl) {
    missingRuntimeInputs.push("server public domain");
  }
  if (!preview.runtime.workerPublicWsEndpoint) {
    missingRuntimeInputs.push("worker public domain");
  }

  return {
    manifest,
    readiness: {
      missingCoreInputs: controlPlaneState.missingCoreInputs,
      missingResourceInputs: controlPlaneState.missingResourceInputs,
      missingRuntimeInputs,
      canProvisionRailway: controlPlaneState.hasCompleteCoreInputs,
      canDeployFullStack:
        controlPlaneState.hasCompleteCoreInputs &&
        controlPlaneState.hasCompleteResourceInputs &&
        missingRuntimeInputs.length === 0,
    },
    railway: {
      environmentName: manifest.railway.environmentName,
      sourceEnvironmentName: manifest.railway.sourceEnvironmentName,
      services: manifest.railway.services,
      serverEnv: redactEnvEntries(serverEnv),
      workerEnv: redactEnvEntries(workerEnv),
    },
    platform: {
      deployTag: manifest.vercel.deployTag,
      previewHost: manifest.vercel.previewHost,
      publicUrl: preview.runtime.previewAppOrigin,
      env: redactEnvEntries(platformEnv),
    },
  };
};
