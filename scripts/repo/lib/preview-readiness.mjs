import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "./paths.mjs";
import {
  PREVIEW_CONTROL_PLANE_SECRET_NAMES,
  PREVIEW_CONTROL_PLANE_VARIABLE_NAMES,
  PREVIEW_RESOURCE_SECRET_NAMES,
  PREVIEW_RESOURCE_VARIABLE_ALTERNATIVES,
  PREVIEW_RESOURCE_VARIABLE_NAMES,
  resolvePreviewGithubConfigReadiness,
} from "./preview-control-plane.mjs";
import {
  createRailwayApiClient,
  resolveRailwayApiToken,
} from "./railway-api.mjs";
import { runCommandResult } from "./shell.mjs";

const readJsonIfExists = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
};

const runJsonCommand = (command, args) => {
  const result = runCommandResult(command, args, {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (result.status !== 0) {
    return {
      ok: false,
      error:
        `${command} ${args.join(" ")} failed` +
        (result.stderr ? `: ${result.stderr.trim()}` : ""),
    };
  }

  try {
    return {
      ok: true,
      value: JSON.parse(result.stdout || "null"),
    };
  } catch (error) {
    return {
      ok: false,
      error: `Failed to parse JSON output from ${command}: ${error.message}`,
    };
  }
};

export const EXPECTED_GITHUB_ACTION_SECRETS =
  PREVIEW_CONTROL_PLANE_SECRET_NAMES;
export const EXPECTED_GITHUB_ACTION_VARIABLES =
  PREVIEW_CONTROL_PLANE_VARIABLE_NAMES;
export const EXPECTED_PREVIEW_RESOURCE_SECRETS = PREVIEW_RESOURCE_SECRET_NAMES;
export const EXPECTED_PREVIEW_RESOURCE_VARIABLES =
  PREVIEW_RESOURCE_VARIABLE_NAMES;
export const EXPECTED_PREVIEW_RESOURCE_VARIABLE_ALTERNATIVES =
  PREVIEW_RESOURCE_VARIABLE_ALTERNATIVES;

export const EXPECTED_RAILWAY_SERVICE_NAMES = [
  "air-jam-server",
  "air-jam-release-browser-worker",
];
export const EXPECTED_RAILWAY_BASE_ENVIRONMENT_NAME = "production";

export const gatherPreviewReadiness = async (env = process.env) => {
  const vercelLink = readJsonIfExists(
    path.join(repoRoot, ".vercel", "project.json"),
  );
  const hasServerRailwayConfig = fs.existsSync(
    path.join(repoRoot, "packages", "server", "railway.json"),
  );
  const hasWorkerRailwayConfig = fs.existsSync(
    path.join(repoRoot, "packages", "release-browser-worker", "railway.json"),
  );
  const hasPreviewWorkflow = fs.existsSync(
    path.join(repoRoot, ".github", "workflows", "preview-full-stack.yml"),
  );
  const hasPreviewDestroyWorkflow = fs.existsSync(
    path.join(
      repoRoot,
      ".github",
      "workflows",
      "preview-full-stack-destroy.yml",
    ),
  );
  const hasPreviewSweepWorkflow = fs.existsSync(
    path.join(repoRoot, ".github", "workflows", "preview-full-stack-sweep.yml"),
  );
  const vercelProject =
    vercelLink?.projectId && vercelLink?.orgId
      ? runJsonCommand("vercel", [
          "api",
          `/v9/projects/${vercelLink.projectId}?teamId=${vercelLink.orgId}`,
          "--raw",
        ])
      : {
          ok: false,
          error: "Missing .vercel project link metadata",
        };

  const githubSecrets = runJsonCommand("gh", [
    "secret",
    "list",
    "--json",
    "name,updatedAt",
  ]);
  const githubVariables = runJsonCommand("gh", [
    "variable",
    "list",
    "--json",
    "name,updatedAt,value",
  ]);
  const availableGithubSecretNames = githubSecrets.ok
    ? new Set(githubSecrets.value.map((entry) => entry.name))
    : new Set();
  const availableGithubVariableNames = githubVariables.ok
    ? new Set(githubVariables.value.map((entry) => entry.name))
    : new Set();
  const railwayErrors = [];
  let railwayEnvironmentNames = [];
  let railwayServiceNames = [];
  const railwayToken = resolveRailwayApiToken(env);
  const githubVariableMap = githubVariables.ok
    ? new Map(githubVariables.value.map((entry) => [entry.name, entry.value]))
    : new Map();
  const railwayProjectId =
    env.RAILWAY_PROJECT_ID?.trim() ??
    githubVariableMap.get("RAILWAY_PROJECT_ID")?.trim() ??
    null;

  if (!railwayToken.token) {
    railwayErrors.push(
      "Missing Railway API token. Set RAILWAY_API_TOKEN or RAILWAY_TOKEN, or log in locally with the Railway CLI.",
    );
  } else if (!railwayProjectId) {
    railwayErrors.push("Missing RAILWAY_PROJECT_ID.");
  } else {
    try {
      const railwayApi = createRailwayApiClient({ env });
      const project = await railwayApi.getProject(railwayProjectId);
      railwayEnvironmentNames = project.environments.map((entry) => entry.name);
      railwayServiceNames = project.services.map((entry) => entry.name);
    } catch (error) {
      railwayErrors.push(error.message);
    }
  }

  const githubReadiness = resolvePreviewGithubConfigReadiness({
    secretNames: [...availableGithubSecretNames],
    variableNames: [...availableGithubVariableNames],
  });
  const missingRailwayServices = EXPECTED_RAILWAY_SERVICE_NAMES.filter(
    (name) => !railwayServiceNames.includes(name),
  );
  const hasProductionEnvironment = railwayEnvironmentNames.includes(
    EXPECTED_RAILWAY_BASE_ENVIRONMENT_NAME,
  );

  return {
    repo: {
      vercelLink,
      hasServerRailwayConfig,
      hasWorkerRailwayConfig,
      hasPreviewWorkflow,
      hasPreviewDestroyWorkflow,
      hasPreviewSweepWorkflow,
    },
    github: {
      secrets: githubSecrets.ok ? githubSecrets.value : null,
      variables: githubVariables.ok ? githubVariables.value : null,
      missingSecrets: githubReadiness.missingControlPlaneSecrets,
      missingVariables: githubReadiness.missingControlPlaneVariables,
      missingResourceSecrets: githubReadiness.missingResourceSecrets,
      missingResourceVariables: githubReadiness.missingResourceVariables,
      missingResourceAlternativeGroups:
        githubReadiness.missingResourceAlternativeGroups,
      errors: [
        ...(githubSecrets.ok ? [] : [githubSecrets.error]),
        ...(githubVariables.ok ? [] : [githubVariables.error]),
      ],
    },
    vercel: {
      previewEnvStrategy: "dynamic-deploy-env",
      ssoProtectionDeploymentType: vercelProject.ok
        ? (vercelProject.value?.ssoProtection?.deploymentType ?? null)
        : null,
      previewProtectionDisabled: vercelProject.ok
        ? vercelProject.value?.ssoProtection == null
        : false,
      errors: vercelProject.ok ? [] : [vercelProject.error],
    },
    railway: {
      tokenSource: railwayToken.source,
      environmentNames: railwayEnvironmentNames,
      serviceNames: railwayServiceNames,
      hasProductionEnvironment,
      missingServices: missingRailwayServices,
      errors: railwayErrors,
    },
  };
};

export const summarizePreviewReadiness = (readiness) => {
  const lines = [];

  lines.push("Preview readiness summary");
  lines.push("");

  lines.push("Repo");
  lines.push(
    `- Vercel link: ${readiness.repo.vercelLink?.projectName ?? "missing"}`,
  );
  lines.push(
    `- Server Railway config: ${readiness.repo.hasServerRailwayConfig ? "present" : "missing"}`,
  );
  lines.push(
    `- Worker Railway config: ${readiness.repo.hasWorkerRailwayConfig ? "present" : "missing"}`,
  );
  lines.push(
    `- Preview workflow: ${readiness.repo.hasPreviewWorkflow ? "present" : "missing"}`,
  );
  lines.push(
    `- Preview destroy workflow: ${readiness.repo.hasPreviewDestroyWorkflow ? "present" : "missing"}`,
  );
  lines.push(
    `- Preview sweep workflow: ${readiness.repo.hasPreviewSweepWorkflow ? "present" : "missing"}`,
  );
  lines.push("");

  lines.push("GitHub Actions");
  lines.push(
    `- Missing control-plane secrets: ${readiness.github.missingSecrets.length ? readiness.github.missingSecrets.join(", ") : "none"}`,
  );
  lines.push(
    `- Missing control-plane variables: ${readiness.github.missingVariables.length ? readiness.github.missingVariables.join(", ") : "none"}`,
  );
  lines.push(
    `- Missing preview resource secrets: ${readiness.github.missingResourceSecrets.length ? readiness.github.missingResourceSecrets.join(", ") : "none"}`,
  );
  lines.push(
    `- Missing preview resource variables: ${readiness.github.missingResourceVariables.length ? readiness.github.missingResourceVariables.join(", ") : "none"}`,
  );
  lines.push(
    `- Missing preview resource alternatives: ${readiness.github.missingResourceAlternativeGroups.length ? readiness.github.missingResourceAlternativeGroups.map((group) => group.join(" or ")).join(", ") : "none"}`,
  );
  if (readiness.github.errors.length) {
    lines.push(`- Errors: ${readiness.github.errors.join(" | ")}`);
  }
  lines.push("");

  lines.push("Vercel");
  lines.push(`- Preview env strategy: ${readiness.vercel.previewEnvStrategy}`);
  lines.push(
    `- Preview deployment protection disabled: ${readiness.vercel.previewProtectionDisabled ? "yes" : "no"}`,
  );
  lines.push(
    `- Preview deployment protection mode: ${readiness.vercel.ssoProtectionDeploymentType ?? "none"}`,
  );
  if (readiness.vercel.errors.length) {
    lines.push(`- Errors: ${readiness.vercel.errors.join(" | ")}`);
  }
  lines.push("");

  lines.push("Railway");
  lines.push(`- Token source: ${readiness.railway.tokenSource ?? "missing"}`);
  lines.push(
    `- Environments: ${readiness.railway.environmentNames.join(", ") || "none"}`,
  );
  lines.push(
    `- Has production base environment: ${readiness.railway.hasProductionEnvironment ? "yes" : "no"}`,
  );
  lines.push(
    `- Missing services: ${readiness.railway.missingServices.length ? readiness.railway.missingServices.join(", ") : "none"}`,
  );
  if (readiness.railway.errors.length) {
    lines.push(`- Errors: ${readiness.railway.errors.join(" | ")}`);
  }

  return lines.join("\n");
};
