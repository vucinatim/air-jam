import { createPreviewOverrideContract } from "./preview-override-contract.mjs";
import { runCommandResult } from "./shell.mjs";

const VERCEL_CLI_MAX_BUFFER = 1024 * 1024 * 20;

const resolveVercelScope = (env = process.env) =>
  env.PREVIEW_VERCEL_SCOPE?.trim() ||
  env.VERCEL_SCOPE?.trim() ||
  null;

const createVercelAuthArgs = ({ token, scope }) => [
  ...(scope ? ["--scope", scope] : []),
  ...(token ? ["--token", token] : []),
];

const parseLeadingJson = (value, label) => {
  const source = value?.trim();
  if (!source) {
    throw new Error(`Missing JSON output from ${label}`);
  }

  const objectIndex = source.indexOf("{");
  const arrayIndex = source.indexOf("[");
  const startIndex =
    objectIndex === -1
      ? arrayIndex
      : arrayIndex === -1
        ? objectIndex
        : Math.min(objectIndex, arrayIndex);

  if (startIndex === -1) {
    throw new Error(`Could not locate JSON payload in ${label} output.`);
  }

  try {
    return JSON.parse(source.slice(startIndex));
  } catch (error) {
    throw new Error(`Failed to parse JSON from ${label}: ${error.message}`);
  }
};

const toVercelEnvArgs = ({ flag, envMap }) =>
  Object.entries(envMap)
    .filter(([, value]) => value != null)
    .flatMap(([key, value]) => [flag, `${key}=${value}`]);

const runVercelJson = ({ args, token, scope = null }) => {
  const authArgs = createVercelAuthArgs({ token, scope });
  const result = runCommandResult(
    "vercel",
    [...args, ...authArgs, "--non-interactive"],
    {
      encoding: "utf8",
      stdio: "pipe",
      maxBuffer: VERCEL_CLI_MAX_BUFFER,
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `vercel ${args.join(" ")} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }

  return parseLeadingJson(result.stdout, `vercel ${args.join(" ")}`);
};

const runVercelCommand = ({
  args,
  token,
  scope = null,
  tolerateAliasMissing = false,
}) => {
  const authArgs = createVercelAuthArgs({ token, scope });
  const result = runCommandResult(
    "vercel",
    [...args, ...authArgs, "--non-interactive"],
    {
      encoding: "utf8",
      stdio: "pipe",
      maxBuffer: VERCEL_CLI_MAX_BUFFER,
    },
  );

  if (result.status === 0) {
    return {
      ok: true,
      stdout: result.stdout?.trim() ?? "",
      stderr: result.stderr?.trim() ?? "",
    };
  }

  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (
    tolerateAliasMissing &&
    /(?:could not find alias|alias.*not found|can't remove alias)/i.test(
      combined,
    )
  ) {
    return {
      ok: false,
      tolerated: true,
      stdout: result.stdout?.trim() ?? "",
      stderr: result.stderr?.trim() ?? "",
    };
  }

  throw new Error(
    `vercel ${args.join(" ")} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
  );
};

const runVercelText = ({ args, token, scope = null }) => {
  const authArgs = createVercelAuthArgs({ token, scope });
  const result = runCommandResult(
    "vercel",
    [...args, ...authArgs, "--non-interactive"],
    {
      encoding: "utf8",
      stdio: "pipe",
      maxBuffer: VERCEL_CLI_MAX_BUFFER,
    },
  );

  if (result.status !== 0) {
    throw new Error(
      `vercel ${args.join(" ")} failed${result.stderr ? `: ${result.stderr.trim()}` : ""}`,
    );
  }

  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
};

const listPreviewDeployments = ({ projectName, previewId, token, scope }) => {
  const payload = runVercelJson({
    args: [
      "list",
      projectName,
      "--meta",
      `airjamPreviewId=${previewId}`,
      "--format",
      "json",
    ],
    token,
    scope,
  });

  return payload.deployments ?? [];
};

export const listAllPreviewDeployments = ({
  projectName,
  token,
  scope = null,
  maxPages = 20,
} = {}) => {
  const deployments = [];
  let next = null;

  for (let page = 0; page < maxPages; page += 1) {
    const payload = runVercelJson({
      args: [
        "list",
        projectName,
        "--format",
        "json",
        ...(next ? ["--next", String(next)] : []),
      ],
      token,
      scope,
    });

    deployments.push(...(payload.deployments ?? []));
    next = payload.pagination?.next ?? null;
    if (!next) {
      break;
    }
  }

  return deployments.filter((deployment) => deployment?.meta?.airjamPreviewId);
};

export const listPreviewAliases = ({
  token,
  scope = null,
  limit = 100,
  maxPages = 20,
} = {}) => {
  const aliases = [];
  let next = null;

  for (let page = 0; page < maxPages; page += 1) {
    const payload = runVercelJson({
      args: [
        "alias",
        "ls",
        "--format",
        "json",
        "--limit",
        String(limit),
        ...(next ? ["--next", String(next)] : []),
      ],
      token,
      scope,
    });

    aliases.push(...(payload.aliases ?? []));
    next = payload.pagination?.next ?? null;
    if (!next) {
      break;
    }
  }

  return aliases;
};

const resolveDeploymentReference = (deployment) =>
  deployment?.url ??
  deployment?.inspectorUrl ??
  deployment?.alias?.[0] ??
  deployment?.aliases?.[0] ??
  deployment?.name ??
  null;

const resolveDeploymentId = (deployment) =>
  deployment?.uid ?? deployment?.id ?? deployment?.deploymentId ?? null;

const hasLocalVercelAuth = () => {
  const result = runCommandResult("vercel", ["whoami"], {
    encoding: "utf8",
    stdio: "pipe",
  });

  return result.status === 0;
};

export const deployPreviewPlatform = ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  serverPublicDomain,
  workerPublicDomain,
  env = process.env,
  apply = false,
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
  const { manifest, controlPlaneState, overrides } = preview;
  const vercelScope = resolveVercelScope(env);
  const hasVercelAuth =
    Boolean(controlPlaneState.controlPlane.vercelToken) || hasLocalVercelAuth();
  const runtimeMissingInputs = [];
  if (!serverPublicDomain) {
    runtimeMissingInputs.push("server public domain");
  }
  if (!workerPublicDomain) {
    runtimeMissingInputs.push("worker public domain");
  }

  const missingInputs = [];
  if (!hasVercelAuth) {
    missingInputs.push("VERCEL_TOKEN or local Vercel auth");
  }
  if (!controlPlaneState.controlPlane.previewBaseDomain) {
    missingInputs.push("PREVIEW_BASE_DOMAIN");
  }
  if (!controlPlaneState.controlPlane.previewAppId) {
    missingInputs.push("PREVIEW_AIR_JAM_APP_ID");
  }
  if (!controlPlaneState.controlPlane.betterAuthSecret) {
    missingInputs.push("PREVIEW_BETTER_AUTH_SECRET");
  }
  if (!controlPlaneState.controlPlane.releasesInternalAccessToken) {
    missingInputs.push("PREVIEW_RELEASES_INTERNAL_ACCESS_TOKEN");
  }
  if (!controlPlaneState.controlPlane.releasesBrowserAccessToken) {
    missingInputs.push("PREVIEW_RELEASES_BROWSER_ACCESS_TOKEN");
  }
  if (!controlPlaneState.rendered.databaseUrl) {
    missingInputs.push("PREVIEW_DATABASE_URL_TEMPLATE");
  }
  if (!controlPlaneState.controlPlane.r2Bucket) {
    missingInputs.push("PREVIEW_R2_BUCKET");
  }
  if (!controlPlaneState.controlPlane.r2AccessKeyId) {
    missingInputs.push("PREVIEW_R2_ACCESS_KEY_ID");
  }
  if (!controlPlaneState.controlPlane.r2SecretAccessKey) {
    missingInputs.push("PREVIEW_R2_SECRET_ACCESS_KEY");
  }
  if (
    !controlPlaneState.controlPlane.r2AccountId &&
    !controlPlaneState.controlPlane.r2Endpoint
  ) {
    missingInputs.push("PREVIEW_R2_ACCOUNT_ID or PREVIEW_R2_ENDPOINT");
  }
  missingInputs.push(...runtimeMissingInputs);

  const actions = [];
  if (!apply) {
    actions.push(`would deploy platform preview ${manifest.previewId}`);
    if (manifest.vercel.previewHost) {
      actions.push(`would alias deployment to ${manifest.vercel.previewHost}`);
    }

    return {
      previewId: manifest.previewId,
      previewHost: manifest.vercel.previewHost,
      apply,
      missingInputs,
      actions,
      deploymentReady: missingInputs.length === 0,
    };
  }

  if (missingInputs.length > 0) {
    return {
      previewId: manifest.previewId,
      previewHost: manifest.vercel.previewHost,
      apply,
      missingInputs,
      actions,
      deploymentReady: false,
    };
  }

  const envArgs = toVercelEnvArgs({
    flag: "--env",
    envMap: overrides.platform.env,
  });
  const buildEnvArgs = toVercelEnvArgs({
    flag: "--build-env",
    envMap: overrides.platform.env,
  });
  const metadata = {
    airjamPreviewId: manifest.previewId,
    airjamPreviewPr: String(manifest.prNumber),
    airjamPreviewBranch: manifest.git.branchSlug,
  };
  const metaArgs = Object.entries(metadata).flatMap(([key, value]) => [
    "--meta",
    `${key}=${value}`,
  ]);

  runVercelCommand({
    args: [
      "deploy",
      "--yes",
      "--public",
      "--target",
      "preview",
      ...metaArgs,
      ...envArgs,
      ...buildEnvArgs,
    ],
    token: controlPlaneState.controlPlane.vercelToken,
    scope: vercelScope,
  });

  const deployments = listPreviewDeployments({
    projectName: manifest.vercel.projectName,
    previewId: manifest.previewId,
    token: controlPlaneState.controlPlane.vercelToken,
    scope: vercelScope,
  });
  const deployment = [...deployments].sort(
    (left, right) => (right.createdAt ?? 0) - (left.createdAt ?? 0),
  )[0];

  const deploymentReference = resolveDeploymentReference(deployment);
  if (!deploymentReference) {
    throw new Error("Vercel deploy did not return a deployment reference.");
  }

  if (manifest.vercel.previewHost) {
    runVercelCommand({
      args: ["alias", "set", deploymentReference, manifest.vercel.previewHost],
      token: controlPlaneState.controlPlane.vercelToken,
      scope: vercelScope,
    });
    actions.push(`aliased deployment to ${manifest.vercel.previewHost}`);
  }

  actions.unshift(`deployed platform preview ${manifest.previewId}`);

  return {
    previewId: manifest.previewId,
    previewHost: manifest.vercel.previewHost,
    apply,
    missingInputs,
    actions,
    deploymentReady: true,
    deployment: {
      id: resolveDeploymentId(deployment),
      url: deployment?.url ?? null,
      inspectorUrl: deployment?.inspectorUrl ?? null,
      reference: deploymentReference,
    },
  };
};

export const previewAliasExists = ({
  host,
  token,
  scope = null,
} = {}) => {
  if (!host) {
    return false;
  }

  const output = runVercelText({
    args: ["alias", "ls"],
    token,
    scope: scope ?? resolveVercelScope(),
  });

  return output
    .split("\n")
    .some((line) => line.trim().split(/\s+/).includes(host));
};

export const destroyPreviewPlatform = ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  env = process.env,
  apply = false,
} = {}) => {
  const preview = createPreviewOverrideContract({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain,
    env,
  });
  const { manifest, controlPlaneState } = preview;
  const actions = [];
  const token = controlPlaneState.controlPlane.vercelToken;
  const vercelScope = resolveVercelScope(env);
  const hasVercelAuth = Boolean(token) || hasLocalVercelAuth();
  const missingInputs = hasVercelAuth ? [] : ["VERCEL_TOKEN or local Vercel auth"];

  if (!apply) {
    actions.push(`would remove alias ${manifest.vercel.previewHost}`);
    actions.push(`would remove deployments tagged ${manifest.previewId}`);
    return {
      previewId: manifest.previewId,
      previewHost: manifest.vercel.previewHost,
      apply,
      missingInputs,
      actions,
    };
  }

  if (missingInputs.length > 0) {
    return {
      previewId: manifest.previewId,
      previewHost: manifest.vercel.previewHost,
      apply,
      missingInputs,
      actions,
    };
  }

  if (manifest.vercel.previewHost) {
    const aliasRemoval = runVercelCommand({
      args: ["alias", "remove", manifest.vercel.previewHost, "--yes"],
      token,
      scope: vercelScope,
      tolerateAliasMissing: true,
    });
    actions.push(
      aliasRemoval.tolerated
        ? `alias ${manifest.vercel.previewHost} already absent`
        : `removed alias ${manifest.vercel.previewHost}`,
    );
  }

  const deployments = listPreviewDeployments({
    projectName: manifest.vercel.projectName,
    previewId: manifest.previewId,
    token,
    scope: vercelScope,
  });
  const deploymentReferences = deployments
    .map((deployment) => resolveDeploymentReference(deployment))
    .filter(Boolean);

  if (deploymentReferences.length > 0) {
    runVercelCommand({
      args: ["remove", ...deploymentReferences, "--yes"],
      token,
      scope: vercelScope,
    });
    actions.push(`removed ${deploymentReferences.length} vercel deployment(s)`);
  } else {
    actions.push("no vercel deployments found for preview");
  }

  return {
    previewId: manifest.previewId,
    previewHost: manifest.vercel.previewHost,
    apply,
    missingInputs,
    actions,
    removedDeployments: deploymentReferences,
  };
};
