import { scheduleLifecycleCleanup } from "@/server/operations/lifecycle-cleanup-service";
import { validateEnv } from "@air-jam/env";
import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { repairExpiredOperationalJobs } from "./operational-job-service";
import {
  operationalJobWorkerKinds,
  runOperationalJobWorkerCycle,
  type OperationalJobWorkerCycleResult,
} from "./operational-job-worker";
import { cleanupReleaseJobOrphanOutputs } from "./release-job-output-cleanup";

const optionalTrimmedString = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined,
  z.string().optional(),
);

const positiveInteger = (fallback: number) =>
  optionalTrimmedString.transform((value, context) => {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      context.addIssue({
        code: "custom",
        message: "Must be a positive integer.",
      });
      return z.NEVER;
    }
    return parsed;
  });

const workerEnvSchema = z
  .object({
    PORT: optionalTrimmedString,
    RAILWAY_ENVIRONMENT_NAME: optionalTrimmedString,
    AIRJAM_PLATFORM_WORKER_PORT: optionalTrimmedString,
    AIRJAM_PLATFORM_WORKER_HOST: optionalTrimmedString.transform(
      (value) => value ?? "0.0.0.0",
    ),
    AIRJAM_PLATFORM_WORKER_ID: optionalTrimmedString,
    AIRJAM_PLATFORM_WORKER_CONTROL_TOKEN: optionalTrimmedString,
    AIRJAM_PLATFORM_WORKER_POLL_MS: positiveInteger(2_000),
    AIRJAM_PLATFORM_WORKER_REPAIR_MS: positiveInteger(30_000),
    AIRJAM_PLATFORM_WORKER_LIFECYCLE_CLEANUP_MS: positiveInteger(900_000),
    AIRJAM_PLATFORM_WORKER_MAX_IN_FLIGHT: positiveInteger(4),
    AIRJAM_PLATFORM_WORKER_DRAIN_TIMEOUT_MS: positiveInteger(300_000),
  })
  .transform((value, context) => {
    if (
      value.RAILWAY_ENVIRONMENT_NAME === "production" &&
      !value.AIRJAM_PLATFORM_WORKER_CONTROL_TOKEN
    ) {
      context.addIssue({
        code: "custom",
        path: ["AIRJAM_PLATFORM_WORKER_CONTROL_TOKEN"],
        message: "A worker control token is required in production.",
      });
      return z.NEVER;
    }
    const portValue = value.PORT ?? value.AIRJAM_PLATFORM_WORKER_PORT ?? "8080";
    const port = Number.parseInt(portValue, 10);
    if (!Number.isSafeInteger(port) || port <= 0 || port > 65_535) {
      context.addIssue({
        code: "custom",
        path: [value.PORT ? "PORT" : "AIRJAM_PLATFORM_WORKER_PORT"],
        message: "Worker port must be between 1 and 65535.",
      });
      return z.NEVER;
    }
    return {
      host: value.AIRJAM_PLATFORM_WORKER_HOST,
      port,
      environmentName: value.RAILWAY_ENVIRONMENT_NAME ?? null,
      workerId:
        value.AIRJAM_PLATFORM_WORKER_ID ??
        `platform-worker:${process.pid}:${crypto.randomUUID()}`,
      controlToken: value.AIRJAM_PLATFORM_WORKER_CONTROL_TOKEN ?? null,
      pollMs: value.AIRJAM_PLATFORM_WORKER_POLL_MS,
      repairMs: value.AIRJAM_PLATFORM_WORKER_REPAIR_MS,
      lifecycleCleanupMs: value.AIRJAM_PLATFORM_WORKER_LIFECYCLE_CLEANUP_MS,
      maxInFlight: value.AIRJAM_PLATFORM_WORKER_MAX_IN_FLIGHT,
      drainTimeoutMs: value.AIRJAM_PLATFORM_WORKER_DRAIN_TIMEOUT_MS,
    };
  });

export type OperationalJobWorkerServiceConfig = z.output<
  typeof workerEnvSchema
>;

export const loadOperationalJobWorkerServiceConfig = (
  env: Record<string, string | undefined> = process.env,
): OperationalJobWorkerServiceConfig =>
  validateEnv({
    boundary: "platform-operational-job-worker",
    schema: workerEnvSchema,
    env,
    docsHint:
      "Set AIRJAM_PLATFORM_WORKER_* variables for the durable operational executor.",
  });

const writeJson = (
  response: ServerResponse,
  statusCode: number,
  value: Record<string, unknown>,
) => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
};

const isAuthorized = ({
  authorization,
  token,
}: {
  authorization: string | undefined;
  token: string | null;
}): boolean => Boolean(token) && authorization === `Bearer ${token}`;

export type OperationalJobWorkerServiceHandle = {
  config: OperationalJobWorkerServiceConfig;
  drain: () => Promise<void>;
  close: () => Promise<void>;
};

export const startOperationalJobWorkerService = async ({
  env = process.env,
  runCycle = runOperationalJobWorkerCycle,
  repair = repairExpiredOperationalJobs,
  cleanup = cleanupReleaseJobOrphanOutputs,
  scheduleCleanup = scheduleLifecycleCleanup,
}: {
  env?: Record<string, string | undefined>;
  runCycle?: typeof runOperationalJobWorkerCycle;
  repair?: typeof repairExpiredOperationalJobs;
  cleanup?: typeof cleanupReleaseJobOrphanOutputs;
  scheduleCleanup?: typeof scheduleLifecycleCleanup;
} = {}): Promise<OperationalJobWorkerServiceHandle> => {
  const config = loadOperationalJobWorkerServiceConfig(env);
  const inFlight = new Set<Promise<OperationalJobWorkerCycleResult>>();
  let accepting = true;
  let closed = false;
  let scheduling = false;
  let lastCycleAt: string | null = null;
  let lastCycleResult: OperationalJobWorkerCycleResult | null = null;
  let lastErrorAt: string | null = null;
  let lastErrorCode: string | null = null;
  let lastAuthoritySuccessAt: string | null = null;
  let authorityReady = false;
  let maintenanceInFlight: Promise<void> | null = null;
  let lifecycleCleanupInFlight: Promise<void> | null = null;
  let kindCursor = 0;

  const recordAuthoritySuccess = () => {
    authorityReady = true;
    lastAuthoritySuccessAt = new Date().toISOString();
  };

  const recordAuthorityFailure = (error: unknown) => {
    authorityReady = false;
    lastErrorAt = new Date().toISOString();
    lastErrorCode =
      error instanceof Error ? error.name : "unknown_worker_error";
  };

  const runOne = (kind: (typeof operationalJobWorkerKinds)[number]) => {
    const task = runCycle({ kind, workerId: config.workerId })
      .then((result) => {
        lastCycleAt = new Date().toISOString();
        lastCycleResult = result;
        recordAuthoritySuccess();
        return result;
      })
      .catch((error: unknown) => {
        recordAuthorityFailure(error);
        throw error;
      })
      .finally(() => {
        inFlight.delete(task);
      });
    inFlight.add(task);
    void task.catch((error: unknown) => {
      console.error(
        JSON.stringify({
          service: "air-jam-platform-worker",
          event: "operational_job.cycle_failed",
          kind,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    });
  };

  const schedule = () => {
    if (!accepting || closed || scheduling) return;
    scheduling = true;
    try {
      while (inFlight.size < config.maxInFlight) {
        const kind =
          operationalJobWorkerKinds[
            kindCursor % operationalJobWorkerKinds.length
          ];
        kindCursor += 1;
        if (!kind) break;
        runOne(kind);
      }
    } finally {
      scheduling = false;
    }
  };

  const scheduler = setInterval(schedule, config.pollMs);
  scheduler.unref();
  schedule();

  const repairExpired = async () => {
    let successful = true;
    const bucket = Math.floor(Date.now() / config.repairMs);
    for (const kind of operationalJobWorkerKinds) {
      try {
        await repair({
          kind,
          actor: config.workerId,
          reason: "Platform worker repaired expired operational job authority.",
          idempotencyKey: `worker-repair:${kind}:${bucket}`,
        });
      } catch (error) {
        successful = false;
        recordAuthorityFailure(error);
        console.error(
          JSON.stringify({
            service: "air-jam-platform-worker",
            event: "operational_job.repair_failed",
            kind,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
    try {
      await cleanup({
        actor: config.workerId,
        reason: "Platform worker removed terminal attempt orphan outputs.",
      });
    } catch (error) {
      successful = false;
      recordAuthorityFailure(error);
      console.error(
        JSON.stringify({
          service: "air-jam-platform-worker",
          event: "operational_job.output_cleanup_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
    if (successful) recordAuthoritySuccess();
  };

  const runMaintenance = () => {
    if (!accepting || closed || maintenanceInFlight) return;
    const task = repairExpired().finally(() => {
      if (maintenanceInFlight === task) maintenanceInFlight = null;
    });
    maintenanceInFlight = task;
  };

  const repairTimer = setInterval(runMaintenance, config.repairMs);
  repairTimer.unref();
  runMaintenance();

  const scheduleCleanupJobs = async () => {
    const bucket = Math.floor(Date.now() / config.lifecycleCleanupMs);
    try {
      await scheduleCleanup({
        actor: config.workerId,
        reason:
          "Platform worker scheduled retention-eligible lifecycle cleanup.",
        idempotencyKey: `worker-lifecycle-cleanup:${bucket}`,
      });
      recordAuthoritySuccess();
    } catch (error) {
      recordAuthorityFailure(error);
      console.error(
        JSON.stringify({
          service: "air-jam-platform-worker",
          event: "lifecycle_cleanup.schedule_failed",
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  };

  const runLifecycleCleanupScheduler = () => {
    if (!accepting || closed || lifecycleCleanupInFlight) return;
    const task = scheduleCleanupJobs().finally(() => {
      if (lifecycleCleanupInFlight === task) lifecycleCleanupInFlight = null;
    });
    lifecycleCleanupInFlight = task;
  };

  const lifecycleCleanupTimer = setInterval(
    runLifecycleCleanupScheduler,
    config.lifecycleCleanupMs,
  );
  lifecycleCleanupTimer.unref();
  runLifecycleCleanupScheduler();

  const status = () => ({
    ok: !closed,
    service: "air-jam-platform-worker",
    workerId: config.workerId,
    accepting,
    draining: !accepting && !closed,
    inFlight: inFlight.size,
    maintenanceInFlight: maintenanceInFlight !== null,
    lifecycleCleanupInFlight: lifecycleCleanupInFlight !== null,
    maxInFlight: config.maxInFlight,
    authorityReady,
    lastAuthoritySuccessAt,
    lastCycleAt,
    lastCycleResult,
    lastErrorAt,
    lastErrorCode,
  });

  const server = createServer((request, response) => {
    const path = request.url ?? "/";
    if (request.method === "GET" && path === "/health") {
      writeJson(response, closed ? 503 : 200, status());
      return;
    }
    if (request.method === "GET" && path === "/ready") {
      writeJson(
        response,
        accepting && !closed && authorityReady ? 200 : 503,
        status(),
      );
      return;
    }
    if (
      !isAuthorized({
        authorization: request.headers.authorization,
        token: config.controlToken,
      })
    ) {
      writeJson(response, config.controlToken ? 401 : 404, {
        ok: false,
        error: config.controlToken ? "unauthorized" : "not_found",
      });
      return;
    }
    if (request.method === "GET" && path === "/status") {
      writeJson(response, 200, status());
      return;
    }
    if (request.method === "POST" && path === "/drain") {
      accepting = false;
      writeJson(response, 202, status());
      return;
    }
    writeJson(response, 404, { ok: false, error: "not_found" });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  console.log(
    JSON.stringify({
      service: "air-jam-platform-worker",
      event: "worker.started",
      workerId: config.workerId,
      host: config.host,
      port: config.port,
      maxInFlight: config.maxInFlight,
    }),
  );

  const drain = async () => {
    accepting = false;
    clearInterval(scheduler);
    clearInterval(repairTimer);
    clearInterval(lifecycleCleanupTimer);
    const timeout = new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, config.drainTimeoutMs);
      timer.unref();
    });
    await Promise.race([
      Promise.allSettled([
        ...inFlight,
        ...(maintenanceInFlight ? [maintenanceInFlight] : []),
        ...(lifecycleCleanupInFlight ? [lifecycleCleanupInFlight] : []),
      ]).then(() => undefined),
      timeout,
    ]);
  };

  const close = async () => {
    if (closed) return;
    await drain();
    closed = true;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  };

  return { config, drain, close };
};
