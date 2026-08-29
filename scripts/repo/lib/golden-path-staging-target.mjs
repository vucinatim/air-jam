import { createRailwayApiClient } from "./railway-api.mjs";

const railwayPlatformConfigFile = "/apps/platform/railway.json";
const railwayReadyDeploymentStatuses = new Set(["SUCCESS", "SLEEPING"]);
const requiredDistinctReleaseCredentials = [
  "AIRJAM_RELEASES_R2_ACCESS_KEY_ID",
  "AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY",
  "AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN",
  "AIRJAM_RELEASES_BROWSER_ACCESS_TOKEN",
];
const optionalProductionSecrets = [
  "AIR_JAM_HOST_GRANT_SECRET",
  "AIR_JAM_MASTER_KEY",
  "BETTER_AUTH_SECRET",
  "GITHUB_CLIENT_SECRET",
  "OPENAI_API_KEY",
];

const listRailwayServiceDomains = (instance) =>
  [
    ...(instance?.domains?.customDomains ?? []).map((entry) => entry.domain),
    ...(instance?.domains?.serviceDomains ?? []).map((entry) => entry.domain),
    instance?.latestDeployment?.staticUrl,
    instance?.latestDeployment?.url,
  ].filter((value) => typeof value === "string" && value.trim().length > 0);

const normalizeHttpsOrigin = (domain) => {
  const url = new URL(
    /^https?:\/\//u.test(domain) ? domain : `https://${domain}`,
  );
  if (url.protocol !== "https:") {
    throw new Error("The Railway staging platform must expose HTTPS.");
  }
  return url.origin;
};

const requireRailwayVariable = (variables, name, environmentName) => {
  const value = variables[name]?.trim();
  if (!value) {
    throw new Error(
      `Railway ${environmentName} platform is missing required ${name}.`,
    );
  }
  return value;
};

const isRailwayEnvironmentScopedUrl = (value) => {
  try {
    return new URL(value).hostname.endsWith(".railway.internal");
  } catch {
    return false;
  }
};

const assertDistinctRequiredVariables = ({
  names,
  stagingVariables,
  primaryVariables,
  stagingEnvironmentName,
  primaryEnvironmentName,
}) => {
  for (const name of names) {
    const stagingValue = requireRailwayVariable(
      stagingVariables,
      name,
      stagingEnvironmentName,
    );
    const primaryValue = requireRailwayVariable(
      primaryVariables,
      name,
      primaryEnvironmentName,
    );
    if (stagingValue === primaryValue) {
      throw new Error(`Railway staging must not reuse production ${name}.`);
    }
  }
};

const assertOptionalProductionSecretsNotReused = ({
  stagingVariables,
  primaryVariables,
}) => {
  const reusedNames = optionalProductionSecrets.filter((name) => {
    const stagingValue = stagingVariables[name]?.trim();
    const primaryValue = primaryVariables[name]?.trim();
    return Boolean(
      stagingValue && primaryValue && stagingValue === primaryValue,
    );
  });
  if (reusedNames.length > 0) {
    throw new Error(
      `Railway staging reuses production-sensitive values for: ${reusedNames.join(", ")}.`,
    );
  }
};

export const assertGoldenPathStagingVariableIsolation = ({
  environmentId,
  environment,
  primaryEnvironment,
  stagingVariables,
  primaryVariables,
}) => {
  const providerEnvironmentId = requireRailwayVariable(
    stagingVariables,
    "RAILWAY_ENVIRONMENT_ID",
    environment.name,
  );
  const providerEnvironmentName = requireRailwayVariable(
    stagingVariables,
    "RAILWAY_ENVIRONMENT_NAME",
    environment.name,
  );
  if (
    providerEnvironmentId !== environmentId ||
    providerEnvironmentName !== environment.name
  ) {
    throw new Error(
      "Railway staging variables do not match the requested environment identity.",
    );
  }

  const stagingDatabaseUrl = requireRailwayVariable(
    stagingVariables,
    "DATABASE_URL",
    environment.name,
  );
  const primaryDatabaseUrl = requireRailwayVariable(
    primaryVariables,
    "DATABASE_URL",
    primaryEnvironment.name,
  );
  if (
    stagingDatabaseUrl === primaryDatabaseUrl &&
    !isRailwayEnvironmentScopedUrl(stagingDatabaseUrl)
  ) {
    throw new Error(
      "Railway staging DATABASE_URL resolves to the same non-scoped database as production.",
    );
  }

  const stagingPostgres = environment.serviceInstances.find(
    (instance) =>
      !instance.railwayConfigFile &&
      instance.serviceName?.toLowerCase().includes("postgres"),
  );
  const primaryPostgres = primaryEnvironment.serviceInstances.find(
    (instance) =>
      !instance.railwayConfigFile &&
      instance.serviceName?.toLowerCase().includes("postgres"),
  );
  if (
    !stagingPostgres?.id ||
    !primaryPostgres?.id ||
    stagingPostgres.id === primaryPostgres.id
  ) {
    throw new Error(
      "Railway staging must expose a Postgres service instance distinct from production.",
    );
  }

  const stagingReleaseBucket = requireRailwayVariable(
    stagingVariables,
    "AIRJAM_RELEASES_R2_BUCKET",
    environment.name,
  );
  const primaryReleaseBucket = requireRailwayVariable(
    primaryVariables,
    "AIRJAM_RELEASES_R2_BUCKET",
    primaryEnvironment.name,
  );
  if (stagingReleaseBucket === primaryReleaseBucket) {
    throw new Error(
      "Railway staging release storage bucket must be distinct from production.",
    );
  }

  assertDistinctRequiredVariables({
    names: requiredDistinctReleaseCredentials,
    stagingVariables,
    primaryVariables,
    stagingEnvironmentName: environment.name,
    primaryEnvironmentName: primaryEnvironment.name,
  });
  assertOptionalProductionSecretsNotReused({
    stagingVariables,
    primaryVariables,
  });

  return {
    providerEnvironmentIdentity: true,
    postgresServiceInstanceDistinct: true,
    databaseTargetDistinctOrProviderScoped: true,
    releaseStorageBucketDistinct: true,
    releaseStorageCredentialsDistinct: true,
    releasePipelineTokensDistinct: true,
    productionSecretsNotReused: true,
    publicOriginDistinct: true,
  };
};

export const resolveGoldenPathRailwayStagingTarget = async ({
  projectId,
  environmentId,
  client = createRailwayApiClient(),
  fetchImpl = fetch,
}) => {
  if (!projectId || !environmentId) {
    throw new Error(
      "Golden-path staging requires Railway project and environment identities.",
    );
  }

  const project = await client.getProject(projectId);
  if (project.id !== projectId) {
    throw new Error(`Railway returned an unexpected project for ${projectId}.`);
  }
  if (
    environmentId === project.primaryEnvironmentId ||
    environmentId === project.baseEnvironmentId
  ) {
    throw new Error(
      "The golden-path run cannot target Railway's primary or base environment.",
    );
  }
  const primaryEnvironmentId =
    project.primaryEnvironmentId ?? project.baseEnvironmentId;
  if (!primaryEnvironmentId) {
    throw new Error(
      `Railway project ${projectId} has no primary environment identity.`,
    );
  }

  const [environment, primaryEnvironment] = await Promise.all([
    client.getEnvironment(environmentId),
    client.getEnvironment(primaryEnvironmentId),
  ]);
  if (environment.projectId !== projectId) {
    throw new Error(
      `Railway environment ${environmentId} does not belong to project ${projectId}.`,
    );
  }
  const stagingNamed =
    environment.name.toLowerCase().includes("staging") ||
    /(?:^|-)pr-\d+(?:$|-)/u.test(environment.name.toLowerCase());
  if (!stagingNamed) {
    throw new Error(
      "The Railway environment must be explicitly named as staging or a PR environment.",
    );
  }
  if (environment.canAccess === false) {
    throw new Error(`Railway environment ${environmentId} is not accessible.`);
  }

  const platformInstance = environment.serviceInstances.find(
    (instance) => instance.railwayConfigFile === railwayPlatformConfigFile,
  );
  const primaryPlatformInstance = primaryEnvironment.serviceInstances.find(
    (instance) => instance.railwayConfigFile === railwayPlatformConfigFile,
  );
  if (!platformInstance) {
    throw new Error(
      `Railway environment ${environmentId} has no canonical Air Jam platform service.`,
    );
  }
  if (!primaryPlatformInstance) {
    throw new Error(
      "Railway's primary environment has no canonical Air Jam platform service.",
    );
  }
  const deployment = platformInstance.latestDeployment;
  if (!deployment || !railwayReadyDeploymentStatuses.has(deployment.status)) {
    throw new Error(
      `Railway staging platform deployment is ${deployment?.status ?? "missing"}; expected SUCCESS or SLEEPING.`,
    );
  }

  const [stagingVariables, primaryVariables] = await Promise.all([
    client.getVariables({
      projectId,
      environmentId,
      serviceId: platformInstance.serviceId,
    }),
    client.getVariables({
      projectId,
      environmentId: primaryEnvironmentId,
      serviceId: primaryPlatformInstance.serviceId,
    }),
  ]);
  const variableIsolation = assertGoldenPathStagingVariableIsolation({
    environmentId,
    environment,
    primaryEnvironment,
    stagingVariables,
    primaryVariables,
  });

  const primaryOrigins = new Set(
    primaryEnvironment.serviceInstances
      .flatMap(listRailwayServiceDomains)
      .map(normalizeHttpsOrigin),
  );
  const stagingUrl = listRailwayServiceDomains(platformInstance)
    .map(normalizeHttpsOrigin)
    .find((origin) => !primaryOrigins.has(origin));
  if (!stagingUrl) {
    throw new Error(
      "Railway staging platform has no public domain distinct from production.",
    );
  }
  const healthUrl = new URL("/api/health", stagingUrl);
  const response = await fetchImpl(healthUrl, {
    signal: AbortSignal.timeout(20_000),
  });
  const responseOrigin = response.url
    ? new URL(response.url).origin
    : stagingUrl;
  if (responseOrigin !== stagingUrl) {
    throw new Error(
      `Railway staging health redirected to a different origin: ${responseOrigin}.`,
    );
  }
  let health = null;
  try {
    health = await response.json();
  } catch {
    // The explicit health assertion below owns the operator-facing failure.
  }
  if (!response.ok || health?.ok !== true || health?.service !== "platform") {
    throw new Error(
      `Railway staging platform health check failed with HTTP ${response.status}.`,
    );
  }

  return {
    provider: "railway",
    projectId,
    projectName: project.name,
    environmentId,
    environmentName: environment.name,
    isEphemeral: environment.isEphemeral === true,
    serviceId: platformInstance.serviceId,
    serviceName: platformInstance.serviceName,
    deploymentId: deployment.id,
    deploymentStatus: deployment.status,
    url: stagingUrl,
    health: { ok: true, service: "platform" },
    isolation: variableIsolation,
    verifiedAt: new Date().toISOString(),
    productionAllowed: false,
  };
};
