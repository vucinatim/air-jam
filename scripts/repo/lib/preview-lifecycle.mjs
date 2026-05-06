import { preparePreviewDatabase, destroyPreviewDatabase } from "./preview-database.mjs";
import {
  preparePreviewRailwayEnvironment,
  destroyPreviewRailwayEnvironment,
  deployPreviewRailwayServices,
  waitForRailwayServicePublicDomain,
} from "./preview-railway.mjs";
import { createPreviewManifest } from "./preview-manifest.mjs";
import {
  deployPreviewPlatform,
  destroyPreviewPlatform,
} from "./preview-vercel.mjs";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, {
    redirect: "follow",
    ...options,
  });
  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body,
  };
};

const verifyPreviewHttpSurface = async ({
  label,
  url,
  headers,
  retries = 10,
  retryDelayMs = 3000,
}) => {
  let lastResult = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const result = await fetchJson(url, { headers });
      lastResult = {
        label,
        url,
        attempt,
        ok: result.ok,
        status: result.status,
        body: result.body,
      };
      if (result.ok) {
        return lastResult;
      }
    } catch (error) {
      lastResult = {
        label,
        url,
        attempt,
        ok: false,
        status: null,
        error: error.message,
      };
    }

    if (attempt < retries) {
      await wait(retryDelayMs);
    }
  }

  return lastResult;
};

export const verifyPreviewDeployment = async ({
  manifest,
  serverPublicDomain,
  workerPublicDomain,
  previewHost,
}) => {
  const serverUrl = serverPublicDomain
    ? `https://${serverPublicDomain}/health`
    : null;
  const workerUrl = workerPublicDomain
    ? `https://${workerPublicDomain}/health`
    : null;
  const platformUrl = previewHost ? `https://${previewHost}` : null;

  const server = serverUrl
    ? await verifyPreviewHttpSurface({
        label: "server",
        url: serverUrl,
      })
    : null;
  const worker = workerUrl
    ? await verifyPreviewHttpSurface({
        label: "browser-worker",
        url: workerUrl,
      })
    : null;
  const platform = platformUrl
    ? await verifyPreviewHttpSurface({
        label: "platform",
        url: platformUrl,
      })
    : null;

  return {
    previewId: manifest.previewId,
    checks: {
      server,
      worker,
      platform,
    },
    ready: [server, worker, platform]
      .filter(Boolean)
      .every((entry) => entry?.ok === true),
  };
};

export const bringPreviewUp = async ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  env = process.env,
  apply = false,
} = {}) => {
  const manifest = createPreviewManifest({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain: previewBaseDomain ?? env.PREVIEW_BASE_DOMAIN,
  });

  const railwayPrepare = preparePreviewRailwayEnvironment({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain: previewBaseDomain ?? env.PREVIEW_BASE_DOMAIN,
    env,
    apply,
  });
  if (apply && !railwayPrepare.environmentReady) {
    throw new Error(
      `Preview Railway environment is not ready for ${manifest.previewId}: ` +
        [
          ...railwayPrepare.missingProjectServices,
          ...railwayPrepare.missingRailwayOverrideInputs,
        ].join(", "),
    );
  }

  const databasePrepare = await preparePreviewDatabase({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain: previewBaseDomain ?? env.PREVIEW_BASE_DOMAIN,
    env,
    apply,
  });
  if (apply && !databasePrepare.ready) {
    throw new Error(
      `Preview database is not ready for ${manifest.previewId}: ${databasePrepare.missingInputs.join(", ")}`,
    );
  }

  const railwayDeploy = deployPreviewRailwayServices({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain: previewBaseDomain ?? env.PREVIEW_BASE_DOMAIN,
    apply,
  });

  const serverPublicDomain = apply
    ? await waitForRailwayServicePublicDomain({
        environmentName: manifest.railway.environmentName,
        serviceName: manifest.railway.services.server,
      })
    : `${manifest.railway.services.server}-${manifest.railway.environmentName}.up.railway.app`;
  const workerPublicDomain = apply
    ? await waitForRailwayServicePublicDomain({
        environmentName: manifest.railway.environmentName,
        serviceName: manifest.railway.services.browserWorker,
      })
    : `${manifest.railway.services.browserWorker}-${manifest.railway.environmentName}.up.railway.app`;
  if (apply && (!serverPublicDomain || !workerPublicDomain)) {
    throw new Error(
      `Preview Railway public domains did not resolve for ${manifest.previewId}.`,
    );
  }

  const platformDeploy = deployPreviewPlatform({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain: previewBaseDomain ?? env.PREVIEW_BASE_DOMAIN,
    serverPublicDomain,
    workerPublicDomain,
    env,
    apply,
  });
  if (apply && !platformDeploy.deploymentReady) {
    throw new Error(
      `Preview platform deployment is not ready for ${manifest.previewId}: ${platformDeploy.missingInputs.join(", ")}`,
    );
  }

  const verification = apply
    ? await verifyPreviewDeployment({
        manifest,
        serverPublicDomain,
        workerPublicDomain,
        previewHost: manifest.vercel.previewHost,
      })
    : {
        previewId: manifest.previewId,
        ready: false,
        checks: {},
      };
  if (apply && !verification.ready) {
    throw new Error(`Preview verification failed for ${manifest.previewId}.`);
  }

  return {
    previewId: manifest.previewId,
    manifest,
    apply,
    railwayPrepare,
    databasePrepare,
    railwayDeploy,
    runtime: {
      serverPublicDomain,
      workerPublicDomain,
      previewHost: manifest.vercel.previewHost,
    },
    platformDeploy,
    verification,
    ready:
      railwayPrepare.environmentReady &&
      databasePrepare.ready &&
      platformDeploy.deploymentReady &&
      (apply ? verification.ready : true),
  };
};

export const tearPreviewDown = async ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  env = process.env,
  apply = false,
} = {}) => {
  const manifest = createPreviewManifest({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain: previewBaseDomain ?? env.PREVIEW_BASE_DOMAIN,
  });

  const platformDestroy = destroyPreviewPlatform({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain: previewBaseDomain ?? env.PREVIEW_BASE_DOMAIN,
    env,
    apply,
  });
  const databaseDestroy = await destroyPreviewDatabase({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain: previewBaseDomain ?? env.PREVIEW_BASE_DOMAIN,
    env,
    apply,
  });
  const railwayDestroy = destroyPreviewRailwayEnvironment({
    environmentName: manifest.railway.environmentName,
    apply,
  });

  return {
    previewId: manifest.previewId,
    manifest,
    apply,
    platformDestroy,
    databaseDestroy,
    railwayDestroy,
  };
};
