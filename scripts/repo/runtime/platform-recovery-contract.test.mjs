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
  const client = {
    getEnvironment: async () => currentEnvironment,
    getDeployment: async () => target,
    rollbackDeployment: async () => {
      mutations += 1;
      currentEnvironment = environment(rolledBack);
      return rolledBack;
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
          deployment: { revision: "revision-old" },
        }),
      }),
    },
  );
  assert.equal(result.status, "verified");
  assert.equal(mutations, 1);
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

test("deployment rollback returns an escalation bundle when health verification fails", async () => {
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
  const client = {
    getEnvironment: async () => currentEnvironment,
    getDeployment: async () => target,
    rollbackDeployment: async () => {
      currentEnvironment = environment(rolledBack);
      return rolledBack;
    },
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
        ok: false,
        status: 503,
        headers: { get: () => "application/json" },
        json: async () => ({
          ok: false,
          deployment: { revision: "revision-old" },
        }),
      }),
    },
  );
  assert.equal(result.status, "verification_failed");
  assert.equal(result.checks.at(-1).id, "application.health");
  assert.equal(result.checks.at(-1).passed, false);
  assert.equal(
    result.escalationBundle.kind,
    "deployment_rollback_verification_failed",
  );
  assert.equal(
    result.escalationBundle.rollbackDeploymentId,
    "deployment-rollback",
  );
});
