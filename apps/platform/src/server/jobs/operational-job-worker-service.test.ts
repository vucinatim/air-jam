import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadOperationalJobWorkerServiceConfig,
  startOperationalJobWorkerService,
  type OperationalJobWorkerServiceHandle,
} from "./operational-job-worker-service";

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
});
