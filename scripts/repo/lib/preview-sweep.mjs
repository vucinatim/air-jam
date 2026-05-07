import { listPreviewSchemas } from "./preview-database.mjs";
import { tearPreviewDown } from "./preview-lifecycle.mjs";
import { createPreviewOverrideContract } from "./preview-override-contract.mjs";
import { listPreviewRailwayEnvironmentNames } from "./preview-railway.mjs";
import { listAllPreviewDeployments, listPreviewAliases } from "./preview-vercel.mjs";

const parseOpenPrNumbers = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => Number.parseInt(String(entry), 10)).filter(Number.isInteger);
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return [];
  }

  const trimmed = value.trim();
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    return parseOpenPrNumbers(parsed);
  }

  return trimmed
    .split(",")
    .map((entry) => Number.parseInt(entry.trim(), 10))
    .filter(Number.isInteger);
};

const extractRailwayPrNumber = (environmentName) => {
  const match = /^preview-pr-(\d+)$/.exec(environmentName);
  return match ? Number.parseInt(match[1], 10) : null;
};

const extractSchemaPrNumber = (schemaName) => {
  const match = /^preview_pr_(\d+)$/.exec(schemaName);
  return match ? Number.parseInt(match[1], 10) : null;
};

const extractPreviewIdPrNumber = (previewId) => {
  const match = /^pr-(\d+)$/.exec(previewId);
  return match ? Number.parseInt(match[1], 10) : null;
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const extractAliasPrNumber = ({ alias, previewBaseDomain }) => {
  const pattern = new RegExp(
    `^(?:pr-|full-pr-)(\\d+)\\.${escapeRegex(previewBaseDomain)}$`,
  );
  const match = pattern.exec(alias);
  return match ? Number.parseInt(match[1], 10) : null;
};

const getOrCreateSourceEntry = (artifactMap, prNumber) => {
  let entry = artifactMap.get(prNumber);
  if (!entry) {
    entry = {
      railwayEnvironments: [],
      databaseSchemas: [],
      vercelDeployments: [],
      vercelAliases: [],
    };
    artifactMap.set(prNumber, entry);
  }

  return entry;
};

export const sweepPreviews = async ({
  openPrNumbers = [],
  env = process.env,
  apply = false,
  discovery = {},
} = {}) => {
  const normalizedOpenPrNumbers = [...new Set(parseOpenPrNumbers(openPrNumbers))].sort(
    (left, right) => left - right,
  );
  const openPrSet = new Set(normalizedOpenPrNumbers);
  const preview = createPreviewOverrideContract({
    prNumber: 1,
    branchName: "preview/sweep",
    commitSha: "previewsweep000000000000000000000000000000",
    previewBaseDomain: env.PREVIEW_BASE_DOMAIN ?? "preview.airjam.io",
    env,
  });
  const previewBaseDomain =
    preview.controlPlaneState.controlPlane.previewBaseDomain ??
    env.PREVIEW_BASE_DOMAIN ??
    "preview.airjam.io";
  const token = preview.controlPlaneState.controlPlane.vercelToken;
  const projectName = preview.manifest.vercel.projectName;

  const artifactMap = new Map();

  const railwayEnvironmentNames =
    discovery.railwayEnvironmentNames ??
    (await listPreviewRailwayEnvironmentNames({ env }));
  for (const environmentName of railwayEnvironmentNames) {
    const prNumber = extractRailwayPrNumber(environmentName);
    if (!prNumber) {
      continue;
    }
    getOrCreateSourceEntry(artifactMap, prNumber).railwayEnvironments.push(
      environmentName,
    );
  }

  const databaseSchemas =
    discovery.databaseSchemas ?? (await listPreviewSchemas({ env }));
  for (const schemaName of databaseSchemas) {
    const prNumber = extractSchemaPrNumber(schemaName);
    if (!prNumber) {
      continue;
    }
    getOrCreateSourceEntry(artifactMap, prNumber).databaseSchemas.push(schemaName);
  }

  const vercelDeployments =
    discovery.vercelDeployments ??
    listAllPreviewDeployments({ projectName, token });
  for (const deployment of vercelDeployments) {
    const prNumber = extractPreviewIdPrNumber(deployment.meta?.airjamPreviewId);
    if (!prNumber) {
      continue;
    }
    getOrCreateSourceEntry(artifactMap, prNumber).vercelDeployments.push(
      deployment.url ?? deployment.name ?? "unknown-deployment",
    );
  }

  const vercelAliases = discovery.vercelAliases ?? listPreviewAliases({ token });
  for (const alias of vercelAliases) {
    const prNumber = extractAliasPrNumber({
      alias: alias.alias,
      previewBaseDomain,
    });
    if (!prNumber) {
      continue;
    }
    getOrCreateSourceEntry(artifactMap, prNumber).vercelAliases.push(alias.alias);
  }

  const discoveredPreviewPrNumbers = [...artifactMap.keys()].sort(
    (left, right) => left - right,
  );
  const orphanPreviewPrNumbers = discoveredPreviewPrNumbers.filter(
    (prNumber) => !openPrSet.has(prNumber),
  );

  const actions = orphanPreviewPrNumbers.map(
    (prNumber) => `destroy preview resources for pr-${prNumber}`,
  );

  if (!apply) {
    return {
      apply,
      openPrNumbers: normalizedOpenPrNumbers,
      discoveredPreviewPrNumbers,
      orphanPreviewPrNumbers,
      artifactsByPrNumber: Object.fromEntries(artifactMap),
      actions,
      results: [],
    };
  }

  const results = [];
  for (const prNumber of orphanPreviewPrNumbers) {
    results.push(
      await tearPreviewDown({
        prNumber,
        previewBaseDomain,
        env,
        apply: true,
      }),
    );
  }

  return {
    apply,
    openPrNumbers: normalizedOpenPrNumbers,
    discoveredPreviewPrNumbers,
    orphanPreviewPrNumbers,
    artifactsByPrNumber: Object.fromEntries(artifactMap),
    actions,
    results,
  };
};
