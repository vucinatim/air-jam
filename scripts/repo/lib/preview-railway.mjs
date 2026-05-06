import fs from "node:fs";
import path from "node:path";
import { runCommandResult } from "./shell.mjs";
import { createPreviewOverrideContract } from "./preview-override-contract.mjs";
import { repoRoot } from "./paths.mjs";

const collectMissingRailwayOverrideInputs = ({ controlPlaneState }) => {
  const missing = [];

  if (!controlPlaneState.controlPlane.previewMasterKey) {
    missing.push("PREVIEW_AIR_JAM_MASTER_KEY");
  }
  if (!controlPlaneState.controlPlane.releasesBrowserAccessToken) {
    missing.push("PREVIEW_RELEASES_BROWSER_ACCESS_TOKEN");
  }
  if (!controlPlaneState.rendered.databaseUrl) {
    missing.push("PREVIEW_DATABASE_URL_TEMPLATE");
  }

  return missing;
};

const PREVIEW_RAILWAY_SERVICE_PACKAGE_PATHS = {
  "air-jam-server": "packages/server",
  "air-jam-release-browser-worker": "packages/release-browser-worker",
};

const PREVIEW_RAILWAY_SERVICE_CONFIG_PATHS = {
  "air-jam-server": "packages/server/railway.json",
  "air-jam-release-browser-worker": "packages/release-browser-worker/railway.json",
};

const PREVIEW_RAILWAY_SERVICE_ALLOWED_UPLOAD_PATHS = {
  "air-jam-server": [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    "scripts/**",
    "packages/server/**",
    "packages/sdk/**",
    "packages/devtools-core/**",
    "packages/harness/**",
    "packages/env/**",
    "packages/runtime-topology/**",
  ],
  "air-jam-release-browser-worker": [
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    "packages/release-browser-worker/**",
    "packages/env/**",
  ],
};

const PREVIEW_RAILWAY_STAGING_DIR = path.join(
  repoRoot,
  ".airjam",
  "preview-railway-staging",
);
const PREVIEW_RAILWAY_STAGING_STATE_PATH = path.join(
  PREVIEW_RAILWAY_STAGING_DIR,
  "state.json",
);

const ensureDirectory = (targetPath) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
};

const sanitizeBackupPath = (targetRelativePath) =>
  targetRelativePath
    .split(path.sep)
    .join("__")
    .replace(/[\\/]/g, "__");

const loadPreviewRailwayStagingState = ({
  stagingStatePath = PREVIEW_RAILWAY_STAGING_STATE_PATH,
} = {}) => {
  if (!fs.existsSync(stagingStatePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(stagingStatePath, "utf8"));
};

const removePreviewRailwayStagingArtifacts = ({
  stagingDir = PREVIEW_RAILWAY_STAGING_DIR,
} = {}) => {
  fs.rmSync(stagingDir, { recursive: true, force: true });
};

export const recoverPreviewRailwayStagingArtifacts = ({
  baseDir = repoRoot,
  stagingDir = PREVIEW_RAILWAY_STAGING_DIR,
  stagingStatePath = PREVIEW_RAILWAY_STAGING_STATE_PATH,
} = {}) => {
  const state = loadPreviewRailwayStagingState({ stagingStatePath });
  if (!state) {
    return false;
  }

  for (const entry of state.entries ?? []) {
    const targetPath = path.join(baseDir, entry.targetRelativePath);

    if (entry.existedBefore && entry.backupRelativePath) {
      const backupPath = path.join(stagingDir, entry.backupRelativePath);
      if (!fs.existsSync(backupPath)) {
        throw new Error(
          `Missing preview Railway staging backup for ${entry.targetRelativePath}`,
        );
      }

      ensureDirectory(targetPath);
      fs.copyFileSync(backupPath, targetPath);
      continue;
    }

    fs.rmSync(targetPath, { force: true });
  }

  removePreviewRailwayStagingArtifacts({ stagingDir });

  return true;
};

const createPreviewRailwayStagingSession = ({
  baseDir = repoRoot,
  stagingDir = PREVIEW_RAILWAY_STAGING_DIR,
  stagingStatePath = PREVIEW_RAILWAY_STAGING_STATE_PATH,
} = {}) => {
  recoverPreviewRailwayStagingArtifacts({
    baseDir,
    stagingDir,
    stagingStatePath,
  });

  fs.mkdirSync(stagingDir, { recursive: true });

  const entries = [];

  const persistState = () => {
    fs.writeFileSync(
      stagingStatePath,
      JSON.stringify(
        {
          entries,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  };

  const registerTarget = (targetRelativePath) => {
    const existing = entries.find(
      (entry) => entry.targetRelativePath === targetRelativePath,
    );
    if (existing) {
      return existing;
    }

    const targetPath = path.join(baseDir, targetRelativePath);
    const existedBefore = fs.existsSync(targetPath);
    const entry = {
      targetRelativePath,
      existedBefore,
      backupRelativePath: null,
    };

    if (existedBefore) {
      entry.backupRelativePath = path.join(
        "backups",
        sanitizeBackupPath(targetRelativePath),
      );
      const backupPath = path.join(stagingDir, entry.backupRelativePath);
      ensureDirectory(backupPath);
      fs.copyFileSync(targetPath, backupPath);
    }

    entries.push(entry);
    persistState();

    return entry;
  };

  return {
    writeFile({ targetRelativePath, contents }) {
      registerTarget(targetRelativePath);
      const targetPath = path.join(baseDir, targetRelativePath);
      ensureDirectory(targetPath);
      fs.writeFileSync(targetPath, contents);
    },
    copyFile({ sourceRelativePath, targetRelativePath }) {
      registerTarget(targetRelativePath);
      const sourcePath = path.join(baseDir, sourceRelativePath);
      const targetPath = path.join(baseDir, targetRelativePath);
      ensureDirectory(targetPath);
      fs.copyFileSync(sourcePath, targetPath);
    },
    cleanup() {
      recoverPreviewRailwayStagingArtifacts({
        baseDir,
        stagingDir,
        stagingStatePath,
      });
    },
  };
};

const createPreviewDeployStamp = ({ serviceName, manifest, stagingSession }) => {
  const relativePackagePath = PREVIEW_RAILWAY_SERVICE_PACKAGE_PATHS[serviceName];
  if (!relativePackagePath) {
    throw new Error(`Unsupported preview Railway service: ${serviceName}`);
  }

  stagingSession.writeFile({
    targetRelativePath: path.join(
      relativePackagePath,
      ".airjam-preview-deploy.json",
    ),
    contents: JSON.stringify(
      {
        previewId: manifest.previewId,
        prNumber: manifest.prNumber,
        serviceName,
        generatedAt: new Date().toISOString(),
        commitSha: manifest.git.commitSha,
      },
      null,
      2,
    ),
  });
};

const stagePreviewRailwayConfig = ({ serviceName, stagingSession }) => {
  const relativeConfigPath = PREVIEW_RAILWAY_SERVICE_CONFIG_PATHS[serviceName];
  if (!relativeConfigPath) {
    throw new Error(`Unsupported preview Railway service config: ${serviceName}`);
  }

  stagingSession.copyFile({
    sourceRelativePath: relativeConfigPath,
    targetRelativePath: "railway.json",
  });
};

const stagePreviewRailwayIgnore = ({ serviceName, stagingSession }) => {
  const allowedPaths = PREVIEW_RAILWAY_SERVICE_ALLOWED_UPLOAD_PATHS[serviceName];
  if (!allowedPaths) {
    throw new Error(`Unsupported preview Railway upload shape: ${serviceName}`);
  }

  const unignoredPaths = new Set([
    "!package.json",
    "!pnpm-lock.yaml",
    "!pnpm-workspace.yaml",
    "!tsconfig.base.json",
  ]);

  for (const entry of allowedPaths) {
    const normalized = entry.endsWith("/**")
      ? entry.replace(/\/\*\*$/, "")
      : entry;
    const segments = normalized.split("/");

    for (let index = 1; index < segments.length; index += 1) {
      unignoredPaths.add(`!${segments.slice(0, index).join("/")}`);
    }

    unignoredPaths.add(`!${normalized}`);
    if (entry.endsWith("/**")) {
      unignoredPaths.add(`!${entry}`);
    }
  }

  const ignoreContents = ["*", ...unignoredPaths].join("\n");

  stagingSession.writeFile({
    targetRelativePath: ".railwayignore",
    contents: `${ignoreContents}\n`,
  });
};

const parseJson = ({ command, args, stdout }) => {
  try {
    return JSON.parse(stdout || "null");
  } catch (error) {
    throw new Error(
      `Failed to parse JSON output from ${command} ${args.join(" ")}: ${error.message}`,
    );
  }
};

const runRailwayJson = (args) => {
  const result = runCommandResult("railway", args, {
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(
      `railway ${args.join(" ")} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }

  return parseJson({
    command: "railway",
    args,
    stdout: result.stdout,
  });
};

const runRailwayCommand = (args) => {
  const result = runCommandResult("railway", args, {
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(
      `railway ${args.join(" ")} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }

  return result.stdout?.trim() ?? "";
};

const listRailwayEnvironments = () => {
  const value = runRailwayJson(["environment", "list", "--json"]);
  if (Array.isArray(value)) {
    return value;
  }

  return Array.isArray(value?.environments) ? value.environments : [];
};

const listRailwayServices = () => runRailwayJson(["service", "list", "--json"]);

const createRailwayEnvironmentFromProduction = ({
  environmentName,
  sourceEnvironmentName,
}) =>
  runRailwayCommand([
    "environment",
    "new",
    environmentName,
    "--duplicate",
    sourceEnvironmentName,
  ]);

const deleteRailwayEnvironment = (environmentName) =>
  runRailwayCommand(["environment", "delete", environmentName, "--yes"]);

const setRailwayVariables = ({ environmentName, serviceName, variables }) => {
  const entries = Object.entries(variables).filter(([, value]) => value != null);
  if (entries.length === 0) {
    return;
  }

  runRailwayCommand([
    "variable",
    "set",
    "--environment",
    environmentName,
    "--service",
    serviceName,
    "--skip-deploys",
    ...entries.map(([key, value]) => `${key}=${value}`),
  ]);
};

export const resolveRailwayServicePublicDomain = ({
  environmentName,
  serviceName,
}) => {
  const variables = runRailwayJson([
    "variable",
    "list",
    "--environment",
    environmentName,
    "--service",
    serviceName,
    "--json",
  ]);

  return (
    variables.RAILWAY_PUBLIC_DOMAIN ??
    variables.RAILWAY_STATIC_URL ??
    null
  );
};

export const waitForRailwayServicePublicDomain = async ({
  environmentName,
  serviceName,
  retries = 30,
  retryDelayMs = 2000,
}) => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const domain = resolveRailwayServicePublicDomain({
      environmentName,
      serviceName,
    });
    if (domain) {
      return domain;
    }

    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  return null;
};

export const preparePreviewRailwayEnvironment = ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  env = process.env,
  apply = false,
}) => {
  const preview = createPreviewOverrideContract({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain,
    env,
  });
  const {
    manifest,
    controlPlaneState,
    overrides: { railway: railwayOverrides },
  } = preview;
  const missingRailwayOverrideInputs = collectMissingRailwayOverrideInputs({
    controlPlaneState,
  });

  const actions = [];
  const environmentsBefore = listRailwayEnvironments();
  const existedBefore = environmentsBefore.some(
    (entry) => entry.name === railwayOverrides.environmentName,
  );

  const projectServices = listRailwayServices();
  const serviceNamesBefore = projectServices.map((entry) => entry.name);
  const missingProjectServices = Object.keys(railwayOverrides.services).filter(
    (name) => !serviceNamesBefore.includes(name),
  );

  if (!existedBefore) {
    if (apply) {
      createRailwayEnvironmentFromProduction({
        environmentName: railwayOverrides.environmentName,
        sourceEnvironmentName: railwayOverrides.sourceEnvironmentName,
      });
      actions.push(
        `duplicated ${railwayOverrides.sourceEnvironmentName} into ${railwayOverrides.environmentName}`,
      );
    } else {
      actions.push(
        `would duplicate ${railwayOverrides.sourceEnvironmentName} into ${railwayOverrides.environmentName}`,
      );
    }
  }

  if (apply && missingRailwayOverrideInputs.length === 0) {
    for (const [serviceName, serviceOverrides] of Object.entries(
      railwayOverrides.services,
    )) {
      setRailwayVariables({
        environmentName: railwayOverrides.environmentName,
        serviceName,
        variables: serviceOverrides,
      });
      actions.push(
        `applied ${Object.keys(serviceOverrides).length} preview overrides to ${serviceName}`,
      );
    }
  } else if (!apply) {
    for (const [serviceName, serviceOverrides] of Object.entries(
      railwayOverrides.services,
    )) {
      actions.push(
        `would apply ${Object.keys(serviceOverrides).length} preview overrides to ${serviceName}`,
      );
    }
  }

  const environmentsAfter = listRailwayEnvironments();
  const existsAfter = environmentsAfter.some(
    (entry) => entry.name === railwayOverrides.environmentName,
  );

  return {
    previewId: manifest.previewId,
    environmentName: railwayOverrides.environmentName,
    sourceEnvironmentName: railwayOverrides.sourceEnvironmentName,
    apply,
    existedBefore,
    existsAfter,
    missingRailwayOverrideInputs,
    serviceNamesBefore,
    missingProjectServices,
    actions,
    environmentReady:
      missingProjectServices.length === 0 &&
      missingRailwayOverrideInputs.length === 0 &&
      (apply ? existsAfter : true),
  };
};

export const destroyPreviewRailwayEnvironment = ({
  environmentName,
  apply = false,
}) => {
  const environmentsBefore = listRailwayEnvironments();
  const existedBefore = environmentsBefore.some(
    (entry) => entry.name === environmentName,
  );
  const actions = [];

  if (!existedBefore) {
    if (!apply) {
      actions.push(`would delete environment ${environmentName}`);
    }

    return {
      environmentName,
      apply,
      existedBefore: false,
      existsAfter: false,
      actions,
    };
  }

  if (apply) {
    deleteRailwayEnvironment(environmentName);
    actions.push(`deleted environment ${environmentName}`);
  } else {
    actions.push(`would delete environment ${environmentName}`);
  }

  const existsAfter = listRailwayEnvironments().some(
    (entry) => entry.name === environmentName,
  );

  return {
    environmentName,
    apply,
    existedBefore,
    existsAfter,
    actions,
  };
};

export const deployPreviewRailwayServices = ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  selectedServices = "all",
  apply = false,
} = {}) => {
  const preview = createPreviewOverrideContract({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain,
  });
  const { manifest } = preview;
  const allServices = Object.values(manifest.railway.services);
  const serviceNames =
    selectedServices === "all"
      ? allServices
      : Array.isArray(selectedServices)
        ? selectedServices
        : [selectedServices];

  const actions = [];

  for (const serviceName of serviceNames) {
    const relativePackagePath = PREVIEW_RAILWAY_SERVICE_PACKAGE_PATHS[serviceName];
    const relativeConfigPath = PREVIEW_RAILWAY_SERVICE_CONFIG_PATHS[serviceName];
    if (!relativePackagePath) {
      throw new Error(`Unsupported preview Railway service: ${serviceName}`);
    }

    if (!apply) {
      actions.push(
        `would deploy ${serviceName} into ${manifest.railway.environmentName} using ${relativeConfigPath}`,
      );
      continue;
    }

    const stagingSession = createPreviewRailwayStagingSession();
    try {
      createPreviewDeployStamp({ serviceName, manifest, stagingSession });
      stagePreviewRailwayConfig({ serviceName, stagingSession });
      stagePreviewRailwayIgnore({ serviceName, stagingSession });

      const result = runCommandResult(
        "railway",
        [
          "up",
          "--environment",
          manifest.railway.environmentName,
          "--service",
          serviceName,
          "--ci",
          "--verbose",
        ],
        {
          stdio: "inherit",
          cwd: repoRoot,
        },
      );

      if (result.status !== 0) {
        throw new Error(
          `railway up failed for ${serviceName} in ${manifest.railway.environmentName}`,
        );
      }

      actions.push(
        `deployed ${serviceName} into ${manifest.railway.environmentName} using ${relativeConfigPath}`,
      );
    } finally {
      stagingSession.cleanup();
    }
  }

  return {
    previewId: manifest.previewId,
    environmentName: manifest.railway.environmentName,
    serviceNames,
    apply,
    actions,
  };
};
