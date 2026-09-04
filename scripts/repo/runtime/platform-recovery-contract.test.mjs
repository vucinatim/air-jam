import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  inspectPlatformRecovery,
  rollbackPlatformDeployment,
  setPlatformBackupSchedule,
} from "../lib/platform-recovery.mjs";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const cliPath = path.join(repoRoot, "scripts/repo/cli.mjs");

const readHelp = (...args) =>
  execFileSync(process.execPath, [cliPath, ...args, "--help"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

const deployment = ({
  id,
  status = "REMOVED",
  canRollback = true,
  revision = "revision-old",
} = {}) => ({
  id,
  status,
  createdAt: "2026-09-04T00:00:00.000Z",
  updatedAt: "2026-09-04T00:01:00.000Z",
  serviceId: "service-platform",
  environmentId: "environment-production",
  meta: { commitHash: revision, imageDigest: `sha256:${revision}` },
  canRedeploy: true,
  canRollback,
});

const environment = (latestDeployment) => ({
  id: "environment-production",
  name: "production",
  projectId: "project-airjam",
  isEphemeral: false,
  serviceInstances: [
    {
      serviceId: "service-platform",
      serviceName: "air-jam-platform",
      railwayConfigFile: "/apps/platform/railway.json",
      latestDeployment,
    },
    {
      serviceId: "service-postgres",
      serviceName: "Postgres",
      railwayConfigFile: null,
      latestDeployment: null,
    },
  ],
  volumeInstances: [
    {
      id: "volume-instance-postgres",
      environmentId: "environment-production",
      serviceId: "service-postgres",
      mountPath: "/var/lib/postgresql/data",
      currentSizeMB: 100,
      sizeMB: 5000,
      state: "READY",
      volume: { id: "volume-postgres", name: "postgres-volume" },
    },
  ],
});

test("recovery CLI exposes preview-first backup and rollback actions", () => {
  const help = readHelp("platform", "recovery");
  const statusHelp = readHelp("platform", "recovery", "status");
  const scheduleHelp = readHelp("platform", "recovery", "backups", "schedule");
  const rollbackHelp = readHelp(
    "platform",
    "recovery",
    "deployment",
    "rollback",
  );
  const restoreHelp = readHelp("platform", "recovery", "restore");
  const restorePlanHelp = readHelp("platform", "recovery", "restore", "plan");
  const restoreApplyHelp = readHelp("platform", "recovery", "restore", "apply");
  const restoreVerifyHelp = readHelp(
    "platform",
    "recovery",
    "restore",
    "verify",
  );
  assert.match(help, /status/u);
  assert.match(help, /backups/u);
  assert.match(help, /deployment/u);
  assert.match(help, /restore/u);
  assert.match(restoreHelp, /plan/u);
  assert.match(restoreHelp, /apply/u);
  assert.match(restoreHelp, /verify/u);
  assert.match(restorePlanHelp, /--backup-manifest/u);
  assert.match(restorePlanHelp, /--railway-environment/u);
  assert.match(restorePlanHelp, /--attest-isolated-loopback/u);
  for (const option of [
    "--plan",
    "--plan-digest",
    "--actor",
    "--reason",
    "--idempotency-key",
    "--apply",
  ]) {
    assert.match(restoreApplyHelp, new RegExp(option, "u"));
  }
  assert.match(restoreVerifyHelp, /--plan-digest/u);
  for (const option of [
    "--railway-project",
    "--railway-environment",
    "--database-service",
    "--json",
  ]) {
    assert.match(statusHelp, new RegExp(option, "u"));
  }
  for (const option of ["--kind", "--actor", "--reason", "--apply"]) {
    assert.match(scheduleHelp, new RegExp(option, "u"));
  }
  for (const option of [
    "--service",
    "--current-deployment",
    "--target-deployment",
    "--health-url",
    "--actor",
    "--reason",
    "--apply",
  ]) {
    assert.match(rollbackHelp, new RegExp(option, "u"));
  }
  assert.match(scheduleHelp, /read-only\s+preview/u);
  assert.match(rollbackHelp, /read-only\s+preview/u);
});

test("recovery status joins provider backup and deployment authority", async () => {
  const current = deployment({
    id: "deployment-current",
    status: "SUCCESS",
    canRollback: true,
    revision: "revision-current",
  });
  const candidate = deployment({ id: "deployment-old" });
  const client = {
    getEnvironment: async () => environment(current),
    listVolumeBackups: async () => [
      {
        id: "backup-1",
        createdAt: "2026-09-04T00:00:00.000Z",
        expiresAt: "2026-09-10T00:00:00.000Z",
      },
    ],
    listVolumeBackupSchedules: async () => [
      { id: "schedule-d", kind: "DAILY" },
      { id: "schedule-w", kind: "WEEKLY" },
      { id: "schedule-m", kind: "MONTHLY" },
    ],
    listDeployments: async () => [current, candidate],
  };
  const result = await inspectPlatformRecovery(
    {
      projectId: "project-airjam",
      environmentId: "environment-production",
      databaseServiceId: "service-postgres",
    },
    { createClient: () => client },
  );
  assert.equal(result.backup.policy.ready, true);
  assert.equal(result.backup.volume.id, "volume-instance-postgres");
  assert.deepEqual(
    result.deployments[0].rollbackCandidates.map((entry) => entry.id),
    ["deployment-old"],
  );
});

test("backup schedule applies once and verifies by provider read-back", async () => {
  const current = deployment({ id: "deployment-current", status: "SUCCESS" });
  let schedules = [];
  let updates = 0;
  const client = {
    getEnvironment: async () => environment(current),
    listVolumeBackups: async () => [],
    listVolumeBackupSchedules: async () => schedules,
    updateVolumeBackupSchedules: async ({ kinds }) => {
      updates += 1;
      schedules = kinds.map((kind) => ({ id: `schedule-${kind}`, kind }));
      return true;
    },
  };
  const preview = await setPlatformBackupSchedule(
    {
      projectId: "project-airjam",
      environmentId: "environment-production",
      databaseServiceId: "service-postgres",
      kinds: ["daily", "weekly", "monthly"],
      actor: "agent:test",
      reason: "Prove recurring recovery.",
    },
    { createClient: () => client },
  );
  assert.equal(preview.status, "change_planned");
  assert.equal(updates, 0);
  const applied = await setPlatformBackupSchedule(
    {
      projectId: "project-airjam",
      environmentId: "environment-production",
      databaseServiceId: "service-postgres",
      kinds: ["daily", "weekly", "monthly"],
      actor: "agent:test",
      reason: "Prove recurring recovery.",
      apply: true,
    },
    { createClient: () => client },
  );
  assert.equal(applied.status, "verified");
  assert.equal(updates, 1);
  assert.equal(applied.checks[0].passed, true);
});

test("backup schedule rejects a partial production policy", async () => {
  await assert.rejects(
    setPlatformBackupSchedule({
      projectId: "project-airjam",
      environmentId: "environment-production",
      databaseServiceId: "service-postgres",
      kinds: ["daily"],
      actor: "agent:test",
      reason: "A partial policy must never remove required schedules.",
    }),
    /exact schedule set/u,
  );
});

test("backup schedule returns exact escalation evidence when read-back differs", async () => {
  const current = deployment({ id: "deployment-current", status: "SUCCESS" });
  const client = {
    getEnvironment: async () => environment(current),
    listVolumeBackups: async () => [],
    listVolumeBackupSchedules: async () => [],
    updateVolumeBackupSchedules: async () => true,
  };
  const result = await setPlatformBackupSchedule(
    {
      projectId: "project-airjam",
      environmentId: "environment-production",
      databaseServiceId: "service-postgres",
      kinds: ["daily", "weekly", "monthly"],
      actor: "agent:test",
      reason: "Prove failed provider read-back.",
      apply: true,
    },
    { createClient: () => client },
  );
  assert.equal(result.status, "verification_failed");
  assert.equal(result.checks[0].passed, false);
  assert.equal(
    result.escalationBundle.kind,
    "backup_schedule_verification_failed",
  );
  assert.equal(
    result.escalationBundle.target.volumeInstanceId,
    "volume-instance-postgres",
  );
});

test("deployment rollback is exact-target fenced and independently verified", async () => {
  const current = deployment({
    id: "deployment-current",
    status: "SUCCESS",
    revision: "revision-current",
  });
  const target = deployment({ id: "deployment-old", revision: "revision-old" });
  const rolledBack = deployment({
    id: "deployment-rollback",
    status: "SUCCESS",
    revision: "revision-old",
  });
  let currentEnvironment = environment(current);
  let mutations = 0;
  let attributionInput = null;
  const client = {
    getEnvironment: async () => currentEnvironment,
    getDeployment: async () => target,
    rollbackDeployment: async () => {
      mutations += 1;
      currentEnvironment = environment(rolledBack);
      return true;
    },
    waitForServiceDeployment: async (input) => {
      attributionInput = input;
      return {
        deployment: rolledBack,
        attempt: 1,
        matched: true,
      };
    },
    waitForDeployment: async () => ({ deployment: rolledBack, ok: true }),
  };
  const input = {
    projectId: "project-airjam",
    environmentId: "environment-production",
    serviceId: "service-platform",
    currentDeploymentId: "deployment-current",
    targetDeploymentId: "deployment-old",
    healthUrl: "https://www.airjam.io/api/readiness",
    actor: "agent:test",
    reason: "Prove exact rollback.",
  };
  const preview = await rollbackPlatformDeployment(input, {
    createClient: () => client,
  });
  assert.equal(preview.status, "rollback_planned");
  assert.equal(mutations, 0);
  const result = await rollbackPlatformDeployment(
    { ...input, apply: true },
    {
      createClient: () => client,
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({
          ok: true,
          deployment: {
            deploymentId: "deployment-rollback",
            revision: null,
          },
        }),
      }),
    },
  );
  assert.equal(result.status, "verified");
  assert.equal(mutations, 1);
  assert.equal(attributionInput.environmentId, "environment-production");
  assert.equal(attributionInput.serviceId, "service-platform");
  assert.equal(attributionInput.matches(rolledBack), true);
  assert.equal(attributionInput.matches(current), false);
  assert.equal(
    attributionInput.matches(
      deployment({ id: "deployment-unrelated", revision: "revision-new" }),
    ),
    false,
  );
  assert.ok(result.checks.every((check) => check.passed));
});

test("deployment rollback refuses a stale current-deployment fence", async () => {
  const client = {
    getEnvironment: async () =>
      environment(deployment({ id: "deployment-new", status: "SUCCESS" })),
  };
  await assert.rejects(
    rollbackPlatformDeployment(
      {
        projectId: "project-airjam",
        environmentId: "environment-production",
        serviceId: "service-platform",
        currentDeploymentId: "deployment-stale",
        targetDeploymentId: "deployment-old",
        healthUrl: "https://www.airjam.io/api/readiness",
        actor: "agent:test",
        reason: "Reject stale target.",
      },
      { createClient: () => client },
    ),
    /Current deployment fence failed/u,
  );
});

test("deployment rollback stops when Railway rejects the provider mutation", async () => {
  const current = deployment({
    id: "deployment-current",
    status: "SUCCESS",
  });
  const target = deployment({ id: "deployment-old" });
  for (const rejection of [false, null]) {
    const client = {
      getEnvironment: async () => environment(current),
      getDeployment: async () => target,
      rollbackDeployment: async () => rejection,
    };
    await assert.rejects(
      rollbackPlatformDeployment(
        {
          projectId: "project-airjam",
          environmentId: "environment-production",
          serviceId: "service-platform",
          currentDeploymentId: "deployment-current",
          targetDeploymentId: "deployment-old",
          healthUrl: "https://www.airjam.io/api/readiness",
          actor: "agent:test",
          reason: "Reject unattributable rollback result.",
          apply: true,
        },
        { createClient: () => client },
      ),
      /did not accept/u,
    );
  }
});

test("deployment rollback preserves evidence when no exact replacement becomes current", async () => {
  const current = deployment({
    id: "deployment-current",
    status: "SUCCESS",
  });
  const target = deployment({ id: "deployment-old" });
  const client = {
    getEnvironment: async () => environment(current),
    getDeployment: async () => target,
    rollbackDeployment: async () => true,
    waitForServiceDeployment: async () => ({
      deployment: current,
      attempt: 2,
      matched: false,
      timeout: true,
    }),
  };
  const result = await rollbackPlatformDeployment(
    {
      projectId: "project-airjam",
      environmentId: "environment-production",
      serviceId: "service-platform",
      currentDeploymentId: "deployment-current",
      targetDeploymentId: "deployment-old",
      healthUrl: "https://www.airjam.io/api/readiness",
      actor: "agent:test",
      reason: "Reject an unattributable provider mutation.",
      apply: true,
    },
    { createClient: () => client },
  );
  assert.equal(result.status, "verification_failed");
  assert.equal(result.applied, true);
  assert.equal(
    result.escalationBundle.kind,
    "deployment_rollback_attribution_failed",
  );
  assert.equal(result.escalationBundle.attribution.timeout, true);
  assert.equal(result.escalationBundle.rollbackDeploymentId, null);
  assert.equal(
    result.escalationBundle.attribution.deployment.id,
    "deployment-current",
  );
});

test("deployment rollback preserves an ambiguous mutation response", async () => {
  const current = deployment({ id: "deployment-current", status: "SUCCESS" });
  const target = deployment({ id: "deployment-old" });
  const client = {
    getEnvironment: async () => environment(current),
    getDeployment: async () => target,
    rollbackDeployment: async () => "deployment-unknown",
  };
  const result = await rollbackPlatformDeployment(
    {
      projectId: "project-airjam",
      environmentId: "environment-production",
      serviceId: "service-platform",
      currentDeploymentId: "deployment-current",
      targetDeploymentId: "deployment-old",
      healthUrl: "https://www.airjam.io/api/readiness",
      actor: "agent:test",
      reason: "Preserve an ambiguous provider response.",
      apply: true,
    },
    { createClient: () => client },
  );
  assert.equal(result.status, "verification_failed");
  assert.equal(result.applied, null);
  assert.equal(
    result.escalationBundle.kind,
    "deployment_rollback_mutation_response_unknown",
  );
});

test("deployment rollback preserves an unknown mutation outcome", async () => {
  const current = deployment({ id: "deployment-current", status: "SUCCESS" });
  const target = deployment({ id: "deployment-old" });
  const client = {
    getEnvironment: async () => environment(current),
    getDeployment: async () => target,
    rollbackDeployment: async () => {
      throw new Error("provider response lost");
    },
  };
  const result = await rollbackPlatformDeployment(
    {
      projectId: "project-airjam",
      environmentId: "environment-production",
      serviceId: "service-platform",
      currentDeploymentId: "deployment-current",
      targetDeploymentId: "deployment-old",
      healthUrl: "https://www.airjam.io/api/readiness",
      actor: "agent:test",
      reason: "Preserve an unknown mutation outcome.",
      apply: true,
    },
    { createClient: () => client },
  );
  assert.equal(result.status, "verification_failed");
  assert.equal(result.applied, null);
  assert.equal(
    result.escalationBundle.kind,
    "deployment_rollback_mutation_outcome_unknown",
  );
  assert.match(result.escalationBundle.error, /provider response lost/u);
});

test("deployment rollback preserves a post-acceptance provider read failure", async () => {
  const current = deployment({ id: "deployment-current", status: "SUCCESS" });
  const target = deployment({ id: "deployment-old" });
  const client = {
    getEnvironment: async () => environment(current),
    getDeployment: async () => target,
    rollbackDeployment: async () => true,
    waitForServiceDeployment: async () => {
      throw new Error("provider read unavailable");
    },
  };
  const result = await rollbackPlatformDeployment(
    {
      projectId: "project-airjam",
      environmentId: "environment-production",
      serviceId: "service-platform",
      currentDeploymentId: "deployment-current",
      targetDeploymentId: "deployment-old",
      healthUrl: "https://www.airjam.io/api/readiness",
      actor: "agent:test",
      reason: "Preserve a post-acceptance provider read failure.",
      apply: true,
    },
    { createClient: () => client },
  );
  assert.equal(result.status, "verification_failed");
  assert.equal(result.applied, true);
  assert.match(result.escalationBundle.error, /provider read unavailable/u);
});

test("deployment rollback fails closed for unhealthy or mismatched readiness", async () => {
  const current = deployment({
    id: "deployment-current",
    status: "SUCCESS",
    revision: "revision-current",
  });
  const target = deployment({ id: "deployment-old", revision: "revision-old" });
  const rolledBack = deployment({
    id: "deployment-rollback",
    status: "SUCCESS",
    revision: "revision-old",
  });
  const cases = [
    {
      label: "unhealthy readiness",
      responseOk: false,
      status: 503,
      body: {
        ok: false,
        deployment: {
          deploymentId: "deployment-rollback",
          revision: "revision-old",
        },
      },
    },
    {
      label: "wrong deployment identity",
      responseOk: true,
      status: 200,
      body: {
        ok: true,
        deployment: {
          deploymentId: "deployment-unrelated",
          revision: "revision-old",
        },
      },
    },
    {
      label: "wrong reported revision",
      responseOk: true,
      status: 200,
      body: {
        ok: true,
        deployment: {
          deploymentId: "deployment-rollback",
          revision: "revision-unrelated",
        },
      },
    },
  ];

  for (const healthCase of cases) {
    let currentEnvironment = environment(current);
    const client = {
      getEnvironment: async () => currentEnvironment,
      getDeployment: async () => target,
      rollbackDeployment: async () => {
        currentEnvironment = environment(rolledBack);
        return true;
      },
      waitForServiceDeployment: async () => ({
        deployment: rolledBack,
        attempt: 1,
        matched: true,
      }),
      waitForDeployment: async () => ({ deployment: rolledBack, ok: true }),
    };
    const result = await rollbackPlatformDeployment(
      {
        projectId: "project-airjam",
        environmentId: "environment-production",
        serviceId: "service-platform",
        currentDeploymentId: "deployment-current",
        targetDeploymentId: "deployment-old",
        healthUrl: "https://www.airjam.io/api/readiness",
        actor: "agent:test",
        reason: "Prove failed application verification.",
        apply: true,
      },
      {
        createClient: () => client,
        fetchImpl: async () => ({
          ok: healthCase.responseOk,
          status: healthCase.status,
          headers: { get: () => "application/json" },
          json: async () => healthCase.body,
        }),
      },
    );
    assert.equal(result.status, "verification_failed", healthCase.label);
    assert.equal(result.checks.at(-1).id, "application.health");
    assert.equal(result.checks.at(-1).passed, false, healthCase.label);
    assert.equal(
      result.escalationBundle.kind,
      "deployment_rollback_checks_failed",
    );
    assert.equal(
      result.escalationBundle.rollbackDeploymentId,
      "deployment-rollback",
    );
  }
});
