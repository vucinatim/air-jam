import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.mjs";

const trimToUndefined = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

const toPositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Preview PR number must be a positive integer. Received: ${value}`);
  }

  return parsed;
};

const shortSha = (value) => trimToUndefined(value)?.slice(0, 12);

const readVercelProjectLink = () => {
  const filePath = path.join(repoRoot, ".vercel", "project.json");
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const appendSubdomain = (baseDomain, label) => {
  const trimmed = trimToUndefined(baseDomain);
  if (!trimmed) {
    return null;
  }

  return `${label}.${trimmed}`;
};

export const createPreviewManifest = ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
} = {}) => {
  const normalizedPrNumber = toPositiveInteger(prNumber);
  const previewId = `pr-${normalizedPrNumber}`;
  const railwayEnvironmentName = `preview-pr-${normalizedPrNumber}`;
  const branchSlug = trimToUndefined(branchName)
    ? slugify(branchName)
    : previewId;
  const commitShortSha = shortSha(commitSha) ?? null;
  const deployTag = commitShortSha
    ? `${previewId}-${commitShortSha}`
    : previewId;
  const vercelLink = readVercelProjectLink();

  return {
    previewId,
    prNumber: normalizedPrNumber,
    git: {
      branchName: trimToUndefined(branchName) ?? null,
      branchSlug,
      commitSha: trimToUndefined(commitSha) ?? null,
      commitShortSha,
    },
    vercel: {
      projectName: vercelLink?.projectName ?? "air-jam",
      projectId: vercelLink?.projectId ?? null,
      deployTag,
      previewHost: appendSubdomain(previewBaseDomain, previewId),
    },
    railway: {
      projectName: "air-jam",
      sourceEnvironmentName: "production",
      environmentName: railwayEnvironmentName,
      services: {
        server: "air-jam-server",
        browserWorker: "air-jam-release-browser-worker",
      },
    },
    database: {
      branchName: previewId,
      schemaName: `preview_pr_${normalizedPrNumber}`,
    },
    storage: {
      prefix: `pr/${normalizedPrNumber}/`,
    },
  };
};
