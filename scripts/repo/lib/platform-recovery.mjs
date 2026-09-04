import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { canonicalJson } from "../../platform/lib/platform-migration-catalog.mjs";
import { repoRoot } from "./paths.mjs";
import { createRailwayApiClient } from "./railway-api.mjs";

export const PLATFORM_RECOVERY_CONTRACT_VERSION = 1;
export const PLATFORM_BACKUP_SCHEDULE_KINDS = Object.freeze([
  "DAILY",
  "WEEKLY",
  "MONTHLY",
]);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

export const writePlatformRecoveryEvidence = ({ kind, result }) => {
  const root = path.join(repoRoot, ".airjam/operations/recovery");
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const digest = result.operationDigest ?? sha256(canonicalJson(result));
  const filePath = path.join(
    root,
    `${kind}-${timestamp}-${digest.slice(0, 12)}.json`,
  );
  const document = `${canonicalJson(result)}\n`;
  fs.writeFileSync(filePath, document, { flag: "wx", mode: 0o600 });
  return {
    path: path.relative(repoRoot, filePath),
    sha256: sha256(document),
    sizeBytes: Buffer.byteLength(document),
  };
};

const requireText = (value, label) => {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
};

const normalizeKinds = (kinds) => {
  const normalized = [
    ...new Set(
      (kinds ?? []).map((kind) =>
        requireText(kind, "Backup schedule kind").toUpperCase(),
      ),
    ),
  ].sort();
  if (normalized.length === 0) {
    throw new Error("At least one backup schedule kind is required.");
  }
  for (const kind of normalized) {
    if (!PLATFORM_BACKUP_SCHEDULE_KINDS.includes(kind)) {
      throw new Error(
        `Backup schedule kind must be one of: ${PLATFORM_BACKUP_SCHEDULE_KINDS.join(", ")}.`,
      );
    }
  }
  const required = [...PLATFORM_BACKUP_SCHEDULE_KINDS].sort();
  if (canonicalJson(normalized) !== canonicalJson(required)) {
    throw new Error(
      `Production backup policy requires the exact schedule set: ${required.join(", ")}.`,
    );
  }
  return normalized;
};

const assertEnvironmentScope = (environment, { projectId, environmentId }) => {
  if (!environment || environment.id !== environmentId) {
    throw new Error(`Railway environment ${environmentId} was not found.`);
  }
  if (environment.projectId !== projectId) {
    throw new Error(
      `Railway environment ${environmentId} does not belong to project ${projectId}.`,
    );
  }
};

const findServiceInstance = (environment, serviceId) => {
  const instance = environment.serviceInstances.find(
    (candidate) => candidate.serviceId === serviceId,
  );
  if (!instance) {
    throw new Error(
      `Service ${serviceId} is not present in Railway environment ${environment.id}.`,
    );
  }
  return instance;
};

const findVolumeInstance = (environment, serviceId) => {
  const matches = environment.volumeInstances.filter(
    (candidate) => candidate.serviceId === serviceId,
  );
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one volume for service ${serviceId} in Railway environment ${environment.id}; found ${matches.length}.`,
    );
  }
  return matches[0];
};

const deploymentRevision = (deployment) => {
  const revision = deployment?.meta?.commitHash;
  return typeof revision === "string" && revision.trim()
    ? revision.trim()
    : null;
};

const summarizeDeployment = (deployment) => ({
  id: deployment.id,
  status: deployment.status,
  createdAt: deployment.createdAt ?? null,
  updatedAt: deployment.updatedAt ?? null,
  serviceId: deployment.serviceId,
  environmentId: deployment.environmentId,
  revision: deploymentRevision(deployment),
  imageDigest:
    typeof deployment.meta?.imageDigest === "string"
      ? deployment.meta.imageDigest
      : null,
  canRedeploy: deployment.canRedeploy,
  canRollback: deployment.canRollback,
});

const inspectBackupAuthority = async ({
  client,
  environment,
  databaseServiceId,
}) => {
  const volume = findVolumeInstance(environment, databaseServiceId);
  const [backups, schedules] = await Promise.all([
    client.listVolumeBackups({ volumeInstanceId: volume.id }),
    client.listVolumeBackupSchedules({ volumeInstanceId: volume.id }),
  ]);
  const orderedBackups = [...backups].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  return {
    serviceId: databaseServiceId,
    volume: {
      id: volume.id,
      name: volume.volume.name,
      mountPath: volume.mountPath,
      state: volume.state,
      currentSizeMB: volume.currentSizeMB,
      capacityMB: volume.sizeMB,
    },
    schedules: [...schedules].sort((left, right) =>
      left.kind.localeCompare(right.kind),
    ),
    backups: orderedBackups,
    latestBackup: orderedBackups[0] ?? null,
  };
};

export const inspectPlatformRecovery = async (
  { projectId, environmentId, databaseServiceId, deploymentLimit = 20 },
  { createClient = createRailwayApiClient } = {},
) => {
  const client = createClient();
  const environment = await client.getEnvironment(environmentId);
  assertEnvironmentScope(environment, { projectId, environmentId });
  const backup = await inspectBackupAuthority({
    client,
    environment,
    databaseServiceId,
  });
  const applicationServices = environment.serviceInstances.filter(
    (instance) => instance.railwayConfigFile,
  );
  const deployments = await Promise.all(
    applicationServices.map(async (instance) => {
      const history = await client.listDeployments({
        projectId,
        environmentId,
        serviceId: instance.serviceId,
        first: deploymentLimit,
      });
      const currentId = instance.latestDeployment?.id ?? null;
      return {
        serviceId: instance.serviceId,
        serviceName: instance.serviceName,
        current: instance.latestDeployment
          ? summarizeDeployment(instance.latestDeployment)
          : null,
        rollbackCandidates: history
          .filter(
            (deployment) =>
              deployment.id !== currentId && deployment.canRollback,
          )
          .map(summarizeDeployment),
      };
    }),
  );
  const observedAt = new Date().toISOString();
  const scheduleKinds = backup.schedules
    .map((schedule) => schedule.kind)
    .sort();
  const desiredKinds = [...PLATFORM_BACKUP_SCHEDULE_KINDS].sort();
  return {
    contractVersion: PLATFORM_RECOVERY_CONTRACT_VERSION,
    status: "inspected",
    observedAt,
    scope: {
      provider: "railway",
      projectId,
      environmentId,
      environmentName: environment.name,
    },
    backup: {
      ...backup,
      policy: {
        desiredKinds,
        observedKinds: scheduleKinds,
        ready: canonicalJson(scheduleKinds) === canonicalJson(desiredKinds),
      },
    },
    deployments,
  };
};

export const setPlatformBackupSchedule = async (
  {
    projectId,
    environmentId,
    databaseServiceId,
    kinds,
    actor,
    reason,
    apply = false,
  },
  { createClient = createRailwayApiClient } = {},
) => {
  const desiredKinds = normalizeKinds(kinds);
  const requestedBy = requireText(actor, "Actor");
  const requestedReason = requireText(reason, "Reason");
  const client = createClient();
  const environment = await client.getEnvironment(environmentId);
  assertEnvironmentScope(environment, { projectId, environmentId });
  const before = await inspectBackupAuthority({
    client,
    environment,
    databaseServiceId,
  });
  const observedKinds = before.schedules
    .map((schedule) => schedule.kind)
    .sort();
  const changeRequired =
    canonicalJson(observedKinds) !== canonicalJson(desiredKinds);
  const request = {
    projectId,
    environmentId,
    databaseServiceId,
    volumeInstanceId: before.volume.id,
    kinds: desiredKinds,
    actor: requestedBy,
    reason: requestedReason,
  };
  const operationDigest = sha256(canonicalJson(request));
  if (!apply) {
    return {
      contractVersion: PLATFORM_RECOVERY_CONTRACT_VERSION,
      status: changeRequired ? "change_planned" : "already_configured",
      applied: false,
      operationDigest,
      request,
      before: { schedules: before.schedules },
    };
  }
  if (changeRequired) {
    await client.updateVolumeBackupSchedules({
      volumeInstanceId: before.volume.id,
      kinds: desiredKinds,
    });
  }
  const after = await inspectBackupAuthority({
    client,
    environment,
    databaseServiceId,
  });
  const afterKinds = after.schedules.map((schedule) => schedule.kind).sort();
  const verified = canonicalJson(afterKinds) === canonicalJson(desiredKinds);
  const result = {
    contractVersion: PLATFORM_RECOVERY_CONTRACT_VERSION,
    status: verified ? "verified" : "verification_failed",
    applied: changeRequired,
    operationDigest,
    request,
    before: { schedules: before.schedules },
    after: { schedules: after.schedules },
    checks: [
      {
        id: "provider.backup-schedule-exact",
        passed: verified,
        expected: desiredKinds,
        observed: afterKinds,
      },
    ],
  };
  if (!verified) {
    result.escalationBundle = {
      kind: "backup_schedule_verification_failed",
      operationDigest,
      target: request,
      checks: result.checks,
      nextActions: [
        "Inspect Railway volume backup schedules for the exact volume instance.",
        "Do not assume recurring backups are active until provider read-back matches.",
      ],
    };
  }
  return result;
};

const fetchHealthEvidence = async ({
  healthUrl,
  fetchImpl,
  expectedDeploymentId,
  expectedRevision,
}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetchImpl(healthUrl, { signal: controller.signal });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await response.json()
      : { text: (await response.text()).slice(0, 500) };
    const reportedDeploymentId = body?.deployment?.deploymentId ?? null;
    const reportedRevision = body?.deployment?.revision ?? null;
    return {
      passed:
        response.ok &&
        body?.ok !== false &&
        reportedDeploymentId === expectedDeploymentId &&
        (!expectedRevision ||
          !reportedRevision ||
          reportedRevision === expectedRevision),
      status: response.status,
      reportedOk: body?.ok ?? null,
      expectedDeploymentId,
      reportedDeploymentId,
      expectedRevision,
      reportedRevision,
    };
  } catch (error) {
    return {
      passed: false,
      expectedDeploymentId,
      reportedDeploymentId: null,
      expectedRevision,
      reportedRevision: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
};

const rollbackNextActions = (kind) =>
  kind === "deployment_rollback_checks_failed"
    ? [
        "Inspect the exact rollback deployment build and runtime logs.",
        "Keep the failed deployment evidence; do not repeat rollback without re-inspecting the current deployment fence.",
        "Choose a known-good rollback or redeploy target only after identifying the failed check.",
      ]
    : [
        "Inspect the exact service deployment history and provider logs before any retry.",
        "Keep this evidence; do not repeat rollback without re-inspecting the current deployment fence.",
        "Choose another exact action only after identifying the failed or ambiguous stage.",
      ];

const buildRollbackResult = ({
  operationDigest,
  request,
  startedAt,
  status,
  applied,
  kind = null,
  error = null,
  attribution = null,
  rollbackDeployment = null,
  checks = [],
}) => {
  const verifiedAt = new Date();
  const result = {
    contractVersion: PLATFORM_RECOVERY_CONTRACT_VERSION,
    status,
    applied,
    operationDigest,
    request,
    startedAt: startedAt.toISOString(),
    verifiedAt: verifiedAt.toISOString(),
    recoveryTimeMs: verifiedAt.getTime() - startedAt.getTime(),
    rollbackDeployment: rollbackDeployment
      ? summarizeDeployment(rollbackDeployment)
      : null,
    checks,
  };
  if (status !== "verified") {
    result.escalationBundle = {
      kind,
      operationDigest,
      target: request,
      rollbackDeploymentId: rollbackDeployment?.id ?? null,
      error,
      attribution,
      checks,
      nextActions: rollbackNextActions(kind),
    };
  }
  return result;
};

export const rollbackPlatformDeployment = async (
  {
    projectId,
    environmentId,
    serviceId,
    currentDeploymentId,
    targetDeploymentId,
    healthUrl,
    actor,
    reason,
    apply = false,
  },
  { createClient = createRailwayApiClient, fetchImpl = fetch } = {},
) => {
  const requestedBy = requireText(actor, "Actor");
  const requestedReason = requireText(reason, "Reason");
  const verificationUrl = requireText(healthUrl, "Health URL");
  const client = createClient();
  const environment = await client.getEnvironment(environmentId);
  assertEnvironmentScope(environment, { projectId, environmentId });
  const service = findServiceInstance(environment, serviceId);
  if (service.latestDeployment?.id !== currentDeploymentId) {
    throw new Error(
      `Current deployment fence failed for service ${serviceId}: expected ${currentDeploymentId}, observed ${service.latestDeployment?.id ?? "none"}.`,
    );
  }
  if (currentDeploymentId === targetDeploymentId) {
    throw new Error("Rollback target must differ from the current deployment.");
  }
  const target = await client.getDeployment(targetDeploymentId);
  if (
    !target ||
    target.serviceId !== serviceId ||
    target.environmentId !== environmentId
  ) {
    throw new Error(
      `Rollback target ${targetDeploymentId} does not belong to the exact service and environment.`,
    );
  }
  if (!target.canRollback) {
    throw new Error(
      `Railway reports deployment ${targetDeploymentId} is not rollback-eligible.`,
    );
  }
  const request = {
    projectId,
    environmentId,
    environmentName: environment.name,
    serviceId,
    serviceName: service.serviceName,
    currentDeploymentId,
    targetDeploymentId,
    targetRevision: deploymentRevision(target),
    targetImageDigest:
      typeof target.meta?.imageDigest === "string"
        ? target.meta.imageDigest
        : null,
    healthUrl: verificationUrl,
    actor: requestedBy,
    reason: requestedReason,
  };
  if (!request.targetRevision && !request.targetImageDigest) {
    throw new Error(
      `Rollback target ${targetDeploymentId} has no revision or image digest for exact post-mutation attribution.`,
    );
  }
  const operationDigest = sha256(canonicalJson(request));
  if (!apply) {
    return {
      contractVersion: PLATFORM_RECOVERY_CONTRACT_VERSION,
      status: "rollback_planned",
      applied: false,
      operationDigest,
      request,
      current: summarizeDeployment(service.latestDeployment),
      target: summarizeDeployment(target),
    };
  }

  const startedAt = new Date();
  let acceptance;
  try {
    acceptance = await client.rollbackDeployment({
      deploymentId: targetDeploymentId,
    });
  } catch (error) {
    return buildRollbackResult({
      operationDigest,
      request,
      startedAt,
      status: "verification_failed",
      applied: null,
      kind: "deployment_rollback_mutation_outcome_unknown",
      error: error instanceof Error ? error.message : String(error),
    });
  }
  if (acceptance === false || acceptance == null) {
    throw new Error(
      "Railway did not accept the exact deployment rollback request; inspect provider state before any retry.",
    );
  }
  if (acceptance !== true) {
    return buildRollbackResult({
      operationDigest,
      request,
      startedAt,
      status: "verification_failed",
      applied: null,
      kind: "deployment_rollback_mutation_response_unknown",
      error: `Railway returned an unrecognized rollback response type (${typeof acceptance}); a rollback may be in flight.`,
    });
  }
  let attribution;
  try {
    attribution = await client.waitForServiceDeployment({
      environmentId,
      serviceId,
      matches: (deployment) =>
        deployment.id !== currentDeploymentId &&
        (request.targetRevision
          ? deploymentRevision(deployment) === request.targetRevision
          : deployment.meta?.imageDigest === request.targetImageDigest),
    });
  } catch (error) {
    return buildRollbackResult({
      operationDigest,
      request,
      startedAt,
      status: "verification_failed",
      applied: true,
      kind: "deployment_rollback_attribution_failed",
      error: error instanceof Error ? error.message : String(error),
    });
  }
  const rollback = attribution.deployment;
  if (!attribution.matched || !rollback?.id) {
    return buildRollbackResult({
      operationDigest,
      request,
      startedAt,
      status: "verification_failed",
      applied: true,
      kind: "deployment_rollback_attribution_failed",
      error:
        attribution.error ??
        "Railway accepted the rollback request but no replacement matching the exact target became current.",
      attribution,
    });
  }
  let terminal;
  try {
    terminal = await client.waitForDeployment({
      deploymentId: rollback.id,
    });
  } catch (error) {
    return buildRollbackResult({
      operationDigest,
      request,
      startedAt,
      status: "verification_failed",
      applied: true,
      kind: "deployment_rollback_verification_failed",
      error: error instanceof Error ? error.message : String(error),
      attribution,
      rollbackDeployment: rollback,
    });
  }
  let afterService;
  try {
    const afterEnvironment = await client.getEnvironment(environmentId);
    assertEnvironmentScope(afterEnvironment, { projectId, environmentId });
    afterService = findServiceInstance(afterEnvironment, serviceId);
  } catch (error) {
    return buildRollbackResult({
      operationDigest,
      request,
      startedAt,
      status: "verification_failed",
      applied: true,
      kind: "deployment_rollback_verification_failed",
      error: error instanceof Error ? error.message : String(error),
      attribution,
      rollbackDeployment: terminal.deployment ?? rollback,
    });
  }
  const expectedRevision = deploymentRevision(target);
  const health = terminal.ok
    ? await fetchHealthEvidence({
        healthUrl: verificationUrl,
        fetchImpl,
        expectedDeploymentId: rollback.id,
        expectedRevision,
      })
    : { passed: false, skipped: true, reason: "deployment_not_healthy" };
  const checks = [
    {
      id: "provider.rollback-terminal-success",
      passed: terminal.ok,
      observed: terminal.deployment?.status ?? null,
    },
    {
      id: "provider.rollback-is-current",
      passed: afterService.latestDeployment?.id === rollback.id,
      expected: rollback.id,
      observed: afterService.latestDeployment?.id ?? null,
    },
    {
      id: "provider.rollback-revision",
      passed:
        !expectedRevision ||
        deploymentRevision(afterService.latestDeployment) === expectedRevision,
      expected: expectedRevision,
      observed: deploymentRevision(afterService.latestDeployment),
    },
    { id: "application.health", ...health },
  ];
  const verified = checks.every((check) => check.passed);
  return buildRollbackResult({
    status: verified ? "verified" : "verification_failed",
    applied: true,
    operationDigest,
    request,
    startedAt,
    rollbackDeployment: terminal.deployment ?? rollback,
    checks,
    ...(verified ? {} : { kind: "deployment_rollback_checks_failed" }),
  });
};
