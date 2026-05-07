import { loadPreviewControlPlane } from "./preview-control-plane.mjs";
import { createPreviewManifest } from "./preview-manifest.mjs";

const toHttpsUrl = (domain) => {
  if (!domain) {
    return null;
  }

  return `https://${domain}`;
};

const toWebSocketUrl = (domain) => {
  if (!domain) {
    return null;
  }

  return `wss://${domain}/ws`;
};

export const createPreviewOverrideContract = ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  serverPublicDomain = null,
  workerPublicDomain = null,
  env = process.env,
} = {}) => {
  const manifest = createPreviewManifest({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain: previewBaseDomain ?? env.PREVIEW_BASE_DOMAIN,
  });
  const controlPlaneState = loadPreviewControlPlane(env, { manifest });
  const { controlPlane } = controlPlaneState;

  const serverPublicUrl = toHttpsUrl(serverPublicDomain);
  const workerPublicUrl = toHttpsUrl(workerPublicDomain);
  const workerPublicWsEndpoint = toWebSocketUrl(workerPublicDomain);
  const previewAppOrigin = manifest.vercel.previewHost
    ? `https://${manifest.vercel.previewHost}`
    : null;

  const railway = {
    environmentName: manifest.railway.environmentName,
    sourceEnvironmentName: manifest.railway.sourceEnvironmentName,
    services: {
      [manifest.railway.services.server]: {
        AIR_JAM_AUTH_MODE: "required",
        AIR_JAM_ALLOW_REMOTE_DATABASE: "enabled",
        AIR_JAM_MASTER_KEY: controlPlane.previewMasterKey,
        DATABASE_URL: controlPlaneState.rendered.databaseUrl,
      },
      [manifest.railway.services.browserWorker]: {
        AIRJAM_BROWSER_WORKER_HEADLESS: "true",
        AIRJAM_BROWSER_WORKER_CHROMIUM_SANDBOX: "false",
        AIRJAM_BROWSER_WORKER_ACCESS_TOKEN:
          controlPlane.releasesBrowserAccessToken,
      },
    },
  };

  const platform = {
    deployTag: manifest.vercel.deployTag,
    previewHost: manifest.vercel.previewHost,
    publicUrl: previewAppOrigin,
    env: {
      NODE_ENV: "production",
      DATABASE_URL: controlPlaneState.rendered.databaseUrl,
      NEXT_PUBLIC_AIR_JAM_APP_ID: controlPlane.previewAppId,
      NEXT_PUBLIC_APP_URL: previewAppOrigin,
      NEXT_PUBLIC_AIR_JAM_SERVER_URL: serverPublicUrl,
      BETTER_AUTH_URL: previewAppOrigin,
      BETTER_AUTH_SECRET: controlPlane.betterAuthSecret,
      AIRJAM_RELEASES_R2_BUCKET: controlPlane.r2Bucket,
      AIRJAM_RELEASES_R2_ACCOUNT_ID: controlPlane.r2AccountId,
      AIRJAM_RELEASES_R2_ENDPOINT: controlPlane.r2Endpoint,
      AIRJAM_RELEASES_R2_ACCESS_KEY_ID: controlPlane.r2AccessKeyId,
      AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY: controlPlane.r2SecretAccessKey,
      AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN:
        controlPlane.releasesInternalAccessToken,
      AIRJAM_RELEASES_BROWSER_WS_ENDPOINT: workerPublicWsEndpoint,
      AIRJAM_RELEASES_BROWSER_ACCESS_TOKEN:
        controlPlane.releasesBrowserAccessToken,
      AIRJAM_RELEASES_IMAGE_MODERATION_MODE: "disabled",
    },
  };

  return {
    manifest,
    controlPlaneState,
    runtime: {
      serverPublicDomain,
      serverPublicUrl,
      workerPublicDomain,
      workerPublicUrl,
      workerPublicWsEndpoint,
      previewAppOrigin,
    },
    overrides: {
      railway,
      platform,
    },
  };
};
