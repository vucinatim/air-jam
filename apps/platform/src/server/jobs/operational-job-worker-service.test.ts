import { platformSchemaHead } from "@/db/platform-schema-head.generated";
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadOperationalJobWorkerServiceConfig,
  startOperationalJobWorkerService,
  type OperationalJobWorkerServiceHandle,
} from "./operational-job-worker-service";

const readCompatibleSchema = async () => ({
  contractVersion: 1 as const,
  status: "ready" as const,
  compatible: true,
  expected: platformSchemaHead,
  observed: {
    createdAt: platformSchemaHead.createdAt,
    hash: platformSchemaHead.hash,
  },
  reason: null,
});

const telemetryRetentionResult = () => ({
  rawEventsDeleted: 0,
  sessionContributionsDeleted: 0,
  rawCutoff: new Date("2026-01-01T00:00:00.000Z"),
  sessionContributionCutoffDate: "2026-01-01",
});

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const reservePort = async (): Promise<number> => {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not reserve a worker test port.");
  }
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
};

const readJson = async (response: Response) => ({
  status: response.status,
  body: (await response.json()) as Record<string, unknown>,
});

describe("operational job worker service", () => {
  let handle: OperationalJobWorkerServiceHandle | null = null;

  afterEach(async () => {
    await handle?.close();
    handle = null;
  });

  it("validates its independently deployable process contract", () => {
    expect(
      loadOperationalJobWorkerServiceConfig({
        PORT: "4321",
        AIRJAM_PLATFORM_WORKER_ID: "worker:test",
        AIRJAM_PLATFORM_WORKER_MAX_IN_FLIGHT: "7",
      }),
    ).toMatchObject({
      host: "0.0.0.0",
      port: 4321,
      workerId: "worker:test",
      maxInFlight: 7,
      telemetryRetentionMs: 900_000,
    });
    expect(() =>
      loadOperationalJobWorkerServiceConfig({
        AIRJAM_PLATFORM_WORKER_PORT: "0",
      }),
    ).toThrow(/invalid environment configuration/i);
    expect(() =>
      loadOperationalJobWorkerServiceConfig({
        RAILWAY_ENVIRONMENT_NAME: "production",
      }),
    ).toThrow(/invalid environment configuration/i);
    expect(() =>
      loadOperationalJobWorkerServiceConfig({
        AIRJAM_PLATFORM_WORKER_ID: "worker with spaces",
      }),
    ).toThrow(/invalid environment configuration/i);
  });

  it("stays unready until database authority succeeds and drains behind authenticated control", async () => {
    const port = await reservePort();
    const cycle = deferred<void>();
    const maintenance = deferred<void>();
    const lifecycleCleanup = deferred<void>();
    handle = await startOperationalJobWorkerService({
      readSchemaCompatibility: readCompatibleSchema,
      env: {
        AIRJAM_PLATFORM_WORKER_HOST: "127.0.0.1",
        AIRJAM_PLATFORM_WORKER_PORT: String(port),
        AIRJAM_PLATFORM_WORKER_ID: "worker:service-test",
        AIRJAM_PLATFORM_WORKER_CONTROL_TOKEN: "test-control-token",
        AIRJAM_PLATFORM_WORKER_POLL_MS: "60000",
        AIRJAM_PLATFORM_WORKER_REPAIR_MS: "60000",
        AIRJAM_PLATFORM_WORKER_LIFECYCLE_CLEANUP_MS: "60000",
        AIRJAM_PLATFORM_WORKER_ISSUE_PROJECTION_MS: "60000",
        AIRJAM_PLATFORM_WORKER_MAX_IN_FLIGHT: "1",
        AIRJAM_PLATFORM_WORKER_DRAIN_TIMEOUT_MS: "1000",
        AIRJAM_GITHUB_ISSUES_APP_ID: "github-app",
        AIRJAM_GITHUB_ISSUES_INSTALLATION_ID: "github-installation",
        AIRJAM_GITHUB_ISSUES_PRIVATE_KEY: "test-private-key",
        AIRJAM_GITHUB_ISSUES_REPOSITORY: "vucinatim/air-jam",
      },
      runCycle: async ({ kind }) => {
        await cycle.promise;
        return { status: "idle", kind };
      },
      repair: async () => {
        await maintenance.promise;
        return { replayed: false, jobs: [] };
      },
      cleanup: async () => ({ candidates: [], cleaned: [] }),
      scheduleCleanup: async () => {
        await lifecycleCleanup.promise;
        return { candidates: [], jobs: [] };
      },
      retainTelemetry: async () => telemetryRetentionResult(),
      deliverEvent: async () => ({ status: "idle" }),
      repairEventDelivery: async () => [],
      repairIssueProjection: async () => [],
      runIssueProjection: async () => ({ status: "idle" }),
      runSynthetics: async () => ({
        environment: "test",
        scheduledAt: new Date().toISOString(),
        dueCount: 2,
        completedCount: 1,
        failureCount: 1,
        staleIgnoredCount: 1,
        skippedCount: 4,
        checks: [
          {
            checkId: "platform-realtime-health",
            status: "failed",
            failure: {
              contractVersion: 1,
              code: "synthetic.schedule_item_failed",
              class: "internal",
              summary: "A due operational synthetic could not be retained.",
              retryable: true,
              details: { checkId: "platform-realtime-health" },
            },
          },
          {
            checkId: "landing-docs",
            status: "completed",
            result: {
              run: {} as never,
              evaluation: null,
              alert: null,
              transition: null,
              evaluationDisposition: "stale_ignored",
            },
          },
        ],
      }),
    });
    const origin = `http://127.0.0.1:${port}`;

    await expect(
      readJson(await fetch(`${origin}/health`)),
    ).resolves.toMatchObject({
      status: 200,
      body: { ok: true, authorityReady: false },
    });
    await expect(
      readJson(await fetch(`${origin}/ready`)),
    ).resolves.toMatchObject({
      status: 503,
      body: { authorityReady: false },
    });

    cycle.resolve();
    let ready: Awaited<ReturnType<typeof readJson>> | null = null;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      ready = await readJson(await fetch(`${origin}/ready`));
      if (ready.status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(ready).toMatchObject({
      status: 200,
      body: {
        authorityReady: true,
        lastAuthoritySuccessAt: expect.any(String),
        authorities: {
          jobs: { status: "ready" },
          eventDelivery: { status: "ready" },
          maintenance: { status: "pending" },
          lifecycleCleanup: { status: "pending" },
          telemetryRetention: { status: "ready" },
          synthetics: {
            status: "failed",
            lastFailureCode: "OperationalSyntheticBatchFailure",
          },
          issueProjection: { status: "ready" },
        },
        issueProjectionConfigured: true,
        lastIssueProjectionStatus: "idle",
        lastSyntheticBatch: {
          dueCount: 2,
          completedCount: 1,
          failureCount: 1,
          staleIgnoredCount: 1,
          skippedCount: 4,
          failedCheckIds: ["platform-realtime-health"],
          staleIgnoredCheckIds: ["landing-docs"],
        },
      },
    });

    await expect(
      readJson(await fetch(`${origin}/status`)),
    ).resolves.toMatchObject({
      status: 401,
      body: { error: "unauthorized" },
    });
    await expect(
      readJson(
        await fetch(`${origin}/drain`, {
          method: "POST",
          headers: { authorization: "Bearer test-control-token" },
        }),
      ),
    ).resolves.toMatchObject({
      status: 202,
      body: { accepting: false, draining: true },
    });
    await expect(
      readJson(await fetch(`${origin}/ready`)),
    ).resolves.toMatchObject({
      status: 503,
      body: { accepting: false },
    });

    maintenance.resolve();
    lifecycleCleanup.resolve();
    await handle.close();
    handle = null;
  });

  it("keeps a lost issue-projection lease visible as degraded authority", async () => {
    const port = await reservePort();
    handle = await startOperationalJobWorkerService({
      readSchemaCompatibility: readCompatibleSchema,
      retainTelemetry: async () => telemetryRetentionResult(),
      env: {
        AIRJAM_PLATFORM_WORKER_HOST: "127.0.0.1",
        AIRJAM_PLATFORM_WORKER_PORT: String(port),
        AIRJAM_PLATFORM_WORKER_ID: "worker:lease-test",
        AIRJAM_PLATFORM_WORKER_POLL_MS: "60000",
        AIRJAM_PLATFORM_WORKER_REPAIR_MS: "60000",
        AIRJAM_PLATFORM_WORKER_LIFECYCLE_CLEANUP_MS: "60000",
        AIRJAM_PLATFORM_WORKER_EVENT_DELIVERY_MS: "60000",
        AIRJAM_PLATFORM_WORKER_SYNTHETIC_MS: "60000",
        AIRJAM_PLATFORM_WORKER_ISSUE_PROJECTION_MS: "60000",
        AIRJAM_PLATFORM_WORKER_MAX_IN_FLIGHT: "1",
        AIRJAM_GITHUB_ISSUES_APP_ID: "github-app",
        AIRJAM_GITHUB_ISSUES_INSTALLATION_ID: "github-installation",
        AIRJAM_GITHUB_ISSUES_PRIVATE_KEY: "test-private-key",
        AIRJAM_GITHUB_ISSUES_REPOSITORY: "vucinatim/air-jam",
      },
      runCycle: async ({ kind }) => ({ status: "idle", kind }),
      repair: async () => ({ replayed: false, jobs: [] }),
      cleanup: async () => ({ candidates: [], cleaned: [] }),
      scheduleCleanup: async () => ({ candidates: [], jobs: [] }),
      deliverEvent: async () => ({ status: "idle" }),
      repairEventDelivery: async () => [],
      repairIssueProjection: async () => [],
      runIssueProjection: async () => ({
        status: "lease_lost",
        projectionId: "projection:lease-test",
      }),
      runSynthetics: async () => ({
        environment: "test",
        scheduledAt: new Date().toISOString(),
        dueCount: 0,
        completedCount: 0,
        failureCount: 0,
        staleIgnoredCount: 0,
        skippedCount: 0,
        checks: [],
      }),
    });
    const origin = `http://127.0.0.1:${port}`;

    let status: Awaited<ReturnType<typeof readJson>> | null = null;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      status = await readJson(await fetch(`${origin}/health`));
      if (
        (status.body.authorities as Record<string, { status: string }>)
          .issueProjection?.status === "failed"
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(status).toMatchObject({
      status: 200,
      body: {
        authorities: {
          issueProjection: {
            status: "failed",
            lastFailureCode: "OperationalAlertIssueProjectionFailure",
          },
        },
        lastIssueProjectionStatus: "lease_lost",
      },
    });
  });

  it("degrades readiness after retention failure and recovers on the next successful run", async () => {
    const port = await reservePort();
    let retentionAttempts = 0;
    handle = await startOperationalJobWorkerService({
      readSchemaCompatibility: readCompatibleSchema,
      env: {
        AIRJAM_PLATFORM_WORKER_HOST: "127.0.0.1",
        AIRJAM_PLATFORM_WORKER_PORT: String(port),
        AIRJAM_PLATFORM_WORKER_ID: "worker:retention-recovery",
        AIRJAM_PLATFORM_WORKER_POLL_MS: "60000",
        AIRJAM_PLATFORM_WORKER_REPAIR_MS: "60000",
        AIRJAM_PLATFORM_WORKER_LIFECYCLE_CLEANUP_MS: "60000",
        AIRJAM_PLATFORM_WORKER_TELEMETRY_RETENTION_MS: "200",
        AIRJAM_PLATFORM_WORKER_EVENT_DELIVERY_MS: "60000",
        AIRJAM_PLATFORM_WORKER_SYNTHETIC_MS: "60000",
        AIRJAM_PLATFORM_WORKER_ISSUE_PROJECTION_MS: "60000",
      },
      runCycle: async ({ kind }) => ({ status: "idle", kind }),
      repair: async () => ({ replayed: false, jobs: [] }),
      cleanup: async () => ({ candidates: [], cleaned: [] }),
      scheduleCleanup: async () => ({ candidates: [], jobs: [] }),
      retainTelemetry: async () => {
        retentionAttempts += 1;
        if (retentionAttempts === 1) {
          throw new Error("retention unavailable");
        }
        return telemetryRetentionResult();
      },
      deliverEvent: async () => ({ status: "idle" }),
      repairEventDelivery: async () => [],
      runSynthetics: async () => ({
        environment: "test",
        scheduledAt: new Date().toISOString(),
        dueCount: 0,
        completedCount: 0,
        failureCount: 0,
        staleIgnoredCount: 0,
        skippedCount: 0,
        checks: [],
      }),
    });
    const origin = `http://127.0.0.1:${port}`;

    let failed: Awaited<ReturnType<typeof readJson>> | null = null;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      failed = await readJson(await fetch(`${origin}/ready`));
      if (
        (failed.body.authorities as Record<string, { status: string }>)
          .telemetryRetention?.status === "failed"
      ) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(failed).toMatchObject({
      status: 503,
      body: {
        authorityReady: false,
        authorities: {
          telemetryRetention: {
            status: "failed",
            lastFailureCode: "Error",
          },
        },
      },
    });

    let recovered: Awaited<ReturnType<typeof readJson>> | null = null;
    for (let attempt = 0; attempt < 50; attempt += 1) {
      recovered = await readJson(await fetch(`${origin}/ready`));
      if (recovered.status === 200) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(recovered).toMatchObject({
      status: 200,
      body: {
        authorityReady: true,
        authorities: { telemetryRetention: { status: "ready" } },
      },
    });
  });

  it("waits for in-flight telemetry retention while draining", async () => {
    const port = await reservePort();
    const retention = deferred<ReturnType<typeof telemetryRetentionResult>>();
    handle = await startOperationalJobWorkerService({
      readSchemaCompatibility: readCompatibleSchema,
      env: {
        AIRJAM_PLATFORM_WORKER_HOST: "127.0.0.1",
        AIRJAM_PLATFORM_WORKER_PORT: String(port),
        AIRJAM_PLATFORM_WORKER_ID: "worker:retention-drain",
        AIRJAM_PLATFORM_WORKER_POLL_MS: "60000",
        AIRJAM_PLATFORM_WORKER_REPAIR_MS: "60000",
        AIRJAM_PLATFORM_WORKER_LIFECYCLE_CLEANUP_MS: "60000",
        AIRJAM_PLATFORM_WORKER_TELEMETRY_RETENTION_MS: "60000",
        AIRJAM_PLATFORM_WORKER_EVENT_DELIVERY_MS: "60000",
        AIRJAM_PLATFORM_WORKER_SYNTHETIC_MS: "60000",
        AIRJAM_PLATFORM_WORKER_ISSUE_PROJECTION_MS: "60000",
        AIRJAM_PLATFORM_WORKER_DRAIN_TIMEOUT_MS: "1000",
      },
      runCycle: async ({ kind }) => ({ status: "idle", kind }),
      repair: async () => ({ replayed: false, jobs: [] }),
      cleanup: async () => ({ candidates: [], cleaned: [] }),
      scheduleCleanup: async () => ({ candidates: [], jobs: [] }),
      retainTelemetry: async () => retention.promise,
      deliverEvent: async () => ({ status: "idle" }),
      repairEventDelivery: async () => [],
      runSynthetics: async () => ({
        environment: "test",
        scheduledAt: new Date().toISOString(),
        dueCount: 0,
        completedCount: 0,
        failureCount: 0,
        staleIgnoredCount: 0,
        skippedCount: 0,
        checks: [],
      }),
    });

    let closed = false;
    const closePromise = handle.close().then(() => {
      closed = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(closed).toBe(false);
    retention.resolve(telemetryRetentionResult());
    await closePromise;
    expect(closed).toBe(true);
    handle = null;
  });

  it("stays observable but schedules no work when schema authority is incompatible", async () => {
    const port = await reservePort();
    let cycles = 0;
    handle = await startOperationalJobWorkerService({
      env: {
        AIRJAM_PLATFORM_WORKER_HOST: "127.0.0.1",
        AIRJAM_PLATFORM_WORKER_PORT: String(port),
        AIRJAM_PLATFORM_WORKER_ID: "worker:schema-blocked",
        AIRJAM_PLATFORM_WORKER_POLL_MS: "60000",
        AIRJAM_PLATFORM_WORKER_REPAIR_MS: "60000",
        AIRJAM_PLATFORM_WORKER_LIFECYCLE_CLEANUP_MS: "60000",
        AIRJAM_PLATFORM_WORKER_EVENT_DELIVERY_MS: "60000",
        AIRJAM_PLATFORM_WORKER_SYNTHETIC_MS: "60000",
        AIRJAM_PLATFORM_WORKER_ISSUE_PROJECTION_MS: "60000",
      },
      readSchemaCompatibility: async () => ({
        contractVersion: 1,
        status: "behind",
        compatible: false,
        expected: platformSchemaHead,
        observed: null,
        reason: "database_schema_behind",
      }),
      retainTelemetry: async () => telemetryRetentionResult(),
      runCycle: async ({ kind }) => {
        cycles += 1;
        return { status: "idle", kind };
      },
    });

    await expect(
      readJson(await fetch(`http://127.0.0.1:${port}/health`)),
    ).resolves.toMatchObject({
      status: 200,
      body: {
        authorityReady: false,
        schemaCompatibility: { status: "behind", compatible: false },
        authorities: { schema: { status: "failed" } },
      },
    });
    await expect(
      readJson(await fetch(`http://127.0.0.1:${port}/ready`)),
    ).resolves.toMatchObject({ status: 503 });
    expect(cycles).toBe(0);
  });
});
