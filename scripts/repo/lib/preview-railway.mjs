import { createPreviewOverrideContract } from "./preview-override-contract.mjs";
import { createRailwayApiClient } from "./railway-api.mjs";

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

const mapByName = (entries) =>
  new Map(entries.map((entry) => [entry.name, entry]));

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveRailwayPreviewContext = ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  env = process.env,
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

  return {
    preview,
    manifest,
    controlPlaneState,
    railwayOverrides,
    projectId: controlPlaneState.controlPlane.railwayProjectId,
  };
};

const getProjectSnapshot = async ({ api, projectId }) => {
  const project = await api.getProject(projectId);
  return {
    project,
    servicesByName: mapByName(project.services),
    environmentsByName: mapByName(project.environments),
  };
};

const getEnvironmentInstanceByServiceName = ({
  environment,
  serviceName,
}) =>
  environment.serviceInstances.find((entry) => entry.serviceName === serviceName) ??
  null;

export const listPreviewRailwayEnvironmentNames = async ({
  env = process.env,
} = {}) => {
  const api = createRailwayApiClient({ env });
  const projectId = env.RAILWAY_PROJECT_ID?.trim();
  if (!projectId) {
    throw new Error("Missing RAILWAY_PROJECT_ID.");
  }

  const environments = await api.listEnvironments({ projectId });
  return environments
    .map((entry) => entry.name)
    .filter((name) => /^preview-pr-\d+$/.test(name));
};

export const resolveRailwayServicePublicDomain = async ({
  environmentId,
  serviceName,
  env = process.env,
}) => {
  const api = createRailwayApiClient({ env });
  return api.resolveServicePublicDomain({
    environmentId,
    serviceName,
  });
};

export const waitForRailwayServicePublicDomain = async ({
  environmentId,
  serviceName,
  env = process.env,
  retries = 30,
  retryDelayMs = 2000,
}) => {
  const api = createRailwayApiClient({ env });
  return api.waitForServicePublicDomain({
    environmentId,
    serviceName,
    retries,
    retryDelayMs,
  });
};

export const preparePreviewRailwayEnvironment = async ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  env = process.env,
  apply = false,
}) => {
  const {
    manifest,
    controlPlaneState,
    railwayOverrides,
    projectId,
  } = resolveRailwayPreviewContext({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain,
    env,
  });

  const missingRailwayOverrideInputs = collectMissingRailwayOverrideInputs({
    controlPlaneState,
  });
  const missingStructureInputs = [];
  const actions = [];
  const projectServiceNames = Object.keys(railwayOverrides.services);

  if (!projectId) {
    missingStructureInputs.push("RAILWAY_PROJECT_ID");
  }

  let environmentId = null;
  let existedBefore = false;
  let existsAfter = false;
  let serviceNamesBefore = [...projectServiceNames];
  let missingProjectServices = [];

  if (!apply || missingStructureInputs.length > 0) {
    if (!apply) {
      actions.push(
        `would duplicate ${railwayOverrides.sourceEnvironmentName} into ${railwayOverrides.environmentName}`,
      );
      for (const [serviceName, serviceOverrides] of Object.entries(
        railwayOverrides.services,
      )) {
        actions.push(
          `would apply ${Object.keys(serviceOverrides).length} preview overrides to ${serviceName}`,
        );
      }
    }

    return {
      previewId: manifest.previewId,
      environmentId,
      environmentName: railwayOverrides.environmentName,
      sourceEnvironmentName: railwayOverrides.sourceEnvironmentName,
      apply,
      existedBefore,
      existsAfter: apply ? existsAfter : true,
      missingRailwayOverrideInputs,
      missingStructureInputs,
      serviceNamesBefore,
      missingProjectServices,
      actions,
      environmentReady:
        missingProjectServices.length === 0 &&
        missingRailwayOverrideInputs.length === 0 &&
        missingStructureInputs.length === 0 &&
        (apply ? existsAfter : true),
    };
  }

  const api = createRailwayApiClient({ env });
  const {
    servicesByName,
    environmentsByName,
  } = await getProjectSnapshot({ api, projectId });

  serviceNamesBefore = [...servicesByName.keys()];
  missingProjectServices = projectServiceNames.filter(
    (name) => !servicesByName.has(name),
  );

  const sourceEnvironment = environmentsByName.get(
    railwayOverrides.sourceEnvironmentName,
  );
  if (!sourceEnvironment) {
    missingStructureInputs.push(
      `source environment ${railwayOverrides.sourceEnvironmentName}`,
    );
  }

  let targetEnvironment = environmentsByName.get(railwayOverrides.environmentName);
  existedBefore = Boolean(targetEnvironment);

  if (
    !targetEnvironment &&
    missingProjectServices.length === 0 &&
    missingRailwayOverrideInputs.length === 0 &&
    missingStructureInputs.length === 0
  ) {
    targetEnvironment = await api.createEnvironment({
      projectId,
      name: railwayOverrides.environmentName,
      sourceEnvironmentId: sourceEnvironment.id,
    });
    actions.push(
      `duplicated ${railwayOverrides.sourceEnvironmentName} into ${railwayOverrides.environmentName}`,
    );
  }

  if (targetEnvironment) {
    environmentId = targetEnvironment.id;
    existsAfter = true;
  }

  if (
    environmentId &&
    missingProjectServices.length === 0 &&
    missingRailwayOverrideInputs.length === 0
  ) {
    for (const [serviceName, serviceOverrides] of Object.entries(
      railwayOverrides.services,
    )) {
      const service = servicesByName.get(serviceName);
      if (!service) {
        continue;
      }

      await api.upsertVariableCollection({
        projectId,
        environmentId,
        serviceId: service.id,
        variables: serviceOverrides,
        skipDeploys: true,
      });
      actions.push(
        `applied ${Object.keys(serviceOverrides).length} preview overrides to ${serviceName}`,
      );
    }
  }

  return {
    previewId: manifest.previewId,
    environmentId,
    environmentName: railwayOverrides.environmentName,
    sourceEnvironmentName: railwayOverrides.sourceEnvironmentName,
    apply,
    existedBefore,
    existsAfter,
    missingRailwayOverrideInputs,
    missingStructureInputs,
    serviceNamesBefore,
    missingProjectServices,
    actions,
    environmentReady:
      missingProjectServices.length === 0 &&
      missingRailwayOverrideInputs.length === 0 &&
      missingStructureInputs.length === 0 &&
      existsAfter,
  };
};

export const destroyPreviewRailwayEnvironment = async ({
  environmentName,
  env = process.env,
  apply = false,
}) => {
  const projectId = env.RAILWAY_PROJECT_ID?.trim() ?? null;
  const actions = [];

  if (!projectId) {
    return {
      environmentName,
      environmentId: null,
      apply,
      existedBefore: false,
      existsAfter: false,
      actions,
      missingStructureInputs: ["RAILWAY_PROJECT_ID"],
    };
  }

  if (!apply) {
    actions.push(`would delete environment ${environmentName}`);
    return {
      environmentName,
      environmentId: null,
      apply,
      existedBefore: true,
      existsAfter: false,
      actions,
      missingStructureInputs: [],
    };
  }

  const api = createRailwayApiClient({ env });
  const environments = await api.listEnvironments({ projectId });
  const targetEnvironment =
    environments.find((entry) => entry.name === environmentName) ?? null;
  const existedBefore = Boolean(targetEnvironment);

  if (!targetEnvironment) {
    return {
      environmentName,
      environmentId: null,
      apply,
      existedBefore: false,
      existsAfter: false,
      actions,
      missingStructureInputs: [],
    };
  }

  await api.deleteEnvironment({
    environmentId: targetEnvironment.id,
  });
  actions.push(`deleted environment ${environmentName}`);

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const remaining = await api.listEnvironments({ projectId });
    if (!remaining.some((entry) => entry.name === environmentName)) {
      return {
        environmentName,
        environmentId: targetEnvironment.id,
        apply,
        existedBefore,
        existsAfter: false,
        actions,
        missingStructureInputs: [],
      };
    }

    if (attempt < 30) {
      await wait(2000);
    }
  }

  return {
    environmentName,
    environmentId: targetEnvironment.id,
    apply,
    existedBefore,
    existsAfter: true,
    actions,
    missingStructureInputs: [],
  };
};

export const deployPreviewRailwayServices = async ({
  prNumber,
  branchName,
  commitSha,
  previewBaseDomain,
  environmentId = null,
  selectedServices = "all",
  env = process.env,
  apply = false,
} = {}) => {
  const {
    manifest,
  } = resolveRailwayPreviewContext({
    prNumber,
    branchName,
    commitSha,
    previewBaseDomain,
    env,
  });
  const allServices = Object.values(manifest.railway.services);
  const serviceNames =
    selectedServices === "all"
      ? allServices
      : Array.isArray(selectedServices)
        ? selectedServices
        : [selectedServices];

  const actions = [];

  if (!apply) {
    for (const serviceName of serviceNames) {
      actions.push(
        `would deploy ${serviceName} into ${manifest.railway.environmentName} from commit ${manifest.git.commitSha}`,
      );
    }

    return {
      previewId: manifest.previewId,
      environmentId,
      environmentName: manifest.railway.environmentName,
      serviceNames,
      apply,
      deployments: [],
      actions,
    };
  }

  if (!environmentId) {
    throw new Error(
      `Missing Railway environment id for ${manifest.previewId} deployment.`,
    );
  }

  const api = createRailwayApiClient({ env });
  const environment = await api.getEnvironment(environmentId);
  const deployments = [];

  for (const serviceName of serviceNames) {
    const instance = getEnvironmentInstanceByServiceName({
      environment,
      serviceName,
    });
    if (!instance) {
      throw new Error(
        `Missing Railway service instance ${serviceName} in ${manifest.railway.environmentName}.`,
      );
    }

    const deploymentId = await api.triggerServiceDeployment({
      environmentId,
      serviceId: instance.serviceId,
      commitSha: manifest.git.commitSha,
    });
    const deployment = await api.waitForDeployment({
      deploymentId,
    });
    if (!deployment.ok) {
      throw new Error(
        `Railway deployment failed for ${serviceName} in ${manifest.railway.environmentName}: ${deployment.deployment?.status ?? "unknown"}`,
      );
    }

    deployments.push({
      serviceName,
      serviceId: instance.serviceId,
      deploymentId,
      status: deployment.deployment?.status ?? null,
    });
    actions.push(
      `deployed ${serviceName} into ${manifest.railway.environmentName} from commit ${manifest.git.commitSha}`,
    );
  }

  return {
    previewId: manifest.previewId,
    environmentId,
    environmentName: manifest.railway.environmentName,
    serviceNames,
    apply,
    deployments,
    actions,
  };
};

