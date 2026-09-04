import { db } from "@/db";
import { executeLifecycleCleanupJobAttempt } from "@/server/operations/lifecycle-cleanup-job-executor";
import { assertPlatformSchemaCompatible } from "@/server/operations/platform-schema-compatibility";
import { executeReleaseArtifactJobAttempt } from "@/server/releases/release-artifact-service";
import { executeReleaseBrowserJobAttempt } from "@/server/releases/release-browser-job-executor";
import { executeReleaseModerationJobAttempt } from "@/server/releases/release-moderation-job-executor";
import {
  operationalJobKindValues,
  type OperationalJobKind,
} from "@air-jam/database-contract";
import {
  lifecycleCleanupJobProgressSchema,
  serializeLifecycleCleanupExecutionError,
  type LifecycleCleanupJobProgress,
} from "./lifecycle-cleanup-job-contract";
import type { JobDatabase } from "./operational-job-internals";
import { getOperationalJobPolicy } from "./operational-job-policy";
import {
  claimOperationalJob,
  failOperationalJobAttempt,
  getOperationalJob,
  heartbeatOperationalJob,
  OperationalJobLeaseError,
  recordOperationalJobStage,
} from "./operational-job-service";
import {
  isReleaseOperationalJobKind,
  parseReleaseJobPayload,
  releaseJobProgressSchema,
  serializeReleaseJobExecutionError,
  type ReleaseJobProgress,
} from "./release-job-contract";

export const operationalJobWorkerKinds = operationalJobKindValues;

export type OperationalJobWorkerCycleResult =
  | { status: "idle"; kind: OperationalJobKind }
  | {
      status: "succeeded" | "retried" | "failed" | "canceled" | "lease_lost";
      kind: OperationalJobKind;
      jobId: string;
      attemptId: string;
    };

export type OperationalJobExecutors = Readonly<{
  artifact: typeof executeReleaseArtifactJobAttempt;
  browser: typeof executeReleaseBrowserJobAttempt;
  moderation: typeof executeReleaseModerationJobAttempt;
  cleanup: typeof executeLifecycleCleanupJobAttempt;
}>;

export const operationalJobExecutors: OperationalJobExecutors = Object.freeze({
  artifact: executeReleaseArtifactJobAttempt,
  browser: executeReleaseBrowserJobAttempt,
  moderation: executeReleaseModerationJobAttempt,
  cleanup: executeLifecycleCleanupJobAttempt,
});

type OperationalJobProgress = ReleaseJobProgress | LifecycleCleanupJobProgress;

const executeClaimedOperationalJob = async ({
  claimed,
  workerId,
  reportProgress,
  database,
  executors,
}: {
  claimed: NonNullable<Awaited<ReturnType<typeof claimOperationalJob>>>;
  workerId: string;
  reportProgress: (
    progress: OperationalJobProgress,
    output?: {
      outputRootKey?: string;
      outputManifest?: Record<string, unknown>;
    },
  ) => Promise<void>;
  database: JobDatabase;
  executors: OperationalJobExecutors;
}) => {
  switch (claimed.kind) {
    case "release_artifact_processing": {
      if (!claimed.releaseId || !claimed.generationId) {
        throw new Error(
          "Operational worker claimed a release job without release scope.",
        );
      }
      const payload = parseReleaseJobPayload(claimed.kind, claimed.payload);
      return executors.artifact({
        jobId: claimed.id,
        releaseId: claimed.releaseId,
        generationId: payload.generationId,
        gameId: claimed.gameId,
        attemptId: claimed.attemptId,
        leaseToken: claimed.leaseToken!,
        workerId,
        reportProgress,
        database,
      });
    }
    case "release_browser_validation": {
      if (!claimed.releaseId || !claimed.generationId) {
        throw new Error(
          "Operational worker claimed a release job without release scope.",
        );
      }
      const payload = parseReleaseJobPayload(claimed.kind, claimed.payload);
      return executors.browser({
        jobId: claimed.id,
        releaseId: claimed.releaseId,
        generationId: payload.generationId,
        gameId: claimed.gameId,
        attemptId: claimed.attemptId,
        leaseToken: claimed.leaseToken!,
        workerId,
        reportProgress,
        database,
      });
    }
    case "release_image_moderation": {
      if (!claimed.releaseId || !claimed.generationId) {
        throw new Error(
          "Operational worker claimed a release job without release scope.",
        );
      }
      const payload = parseReleaseJobPayload(claimed.kind, claimed.payload);
      return executors.moderation({
        jobId: claimed.id,
        releaseId: claimed.releaseId,
        generationId: payload.generationId,
        gameId: claimed.gameId,
        leaseToken: claimed.leaseToken!,
        workerId,
        screenshot: payload.screenshot,
        reportProgress,
        database,
      });
    }
    case "lifecycle_cleanup":
      return executors.cleanup({
        jobId: claimed.id,
        leaseToken: claimed.leaseToken!,
        workerId,
        creatorId: claimed.creatorId,
        gameId: claimed.gameId,
        releaseId: claimed.releaseId,
        payload: claimed.payload,
        reportProgress,
        database,
      });
  }
};

export const runOperationalJobWorkerCycle = async ({
  kind,
  workerId,
  database = db,
  executors = operationalJobExecutors,
  assertSchemaCompatible = assertPlatformSchemaCompatible,
}: {
  kind: OperationalJobKind;
  workerId: string;
  database?: JobDatabase;
  executors?: OperationalJobExecutors;
  assertSchemaCompatible?: typeof assertPlatformSchemaCompatible;
}): Promise<OperationalJobWorkerCycleResult> => {
  await assertSchemaCompatible({ database });
  const claimed = await claimOperationalJob({ database, kind, workerId });
  if (!claimed) return { status: "idle", kind };
  if (!claimed.leaseToken) {
    throw new Error("Claimed operational job did not include a lease token.");
  }

  let currentStage: OperationalJobProgress["stage"] | null = null;
  let heartbeatInFlight = false;
  let heartbeatError: unknown = null;
  const policy = getOperationalJobPolicy(kind);
  const heartbeatInterval = setInterval(
    () => {
      if (heartbeatInFlight || heartbeatError) return;
      heartbeatInFlight = true;
      void heartbeatOperationalJob({
        database,
        jobId: claimed.id,
        leaseToken: claimed.leaseToken!,
        workerId,
      })
        .catch((error: unknown) => {
          heartbeatError = error;
        })
        .finally(() => {
          heartbeatInFlight = false;
        });
    },
    Math.max(1_000, Math.floor((policy.leaseSeconds * 1_000) / 3)),
  );
  heartbeatInterval.unref();

  const reportProgress = async (
    rawProgress: OperationalJobProgress,
    output?: {
      outputRootKey?: string;
      outputManifest?: Record<string, unknown>;
    },
  ) => {
    if (heartbeatError) throw heartbeatError;
    const progress = isReleaseOperationalJobKind(kind)
      ? releaseJobProgressSchema.parse(rawProgress)
      : lifecycleCleanupJobProgressSchema.parse(rawProgress);
    currentStage = progress.stage;
    await recordOperationalJobStage({
      database,
      jobId: claimed.id,
      leaseToken: claimed.leaseToken!,
      workerId,
      progress,
      outputRootKey: output?.outputRootKey,
      outputManifest: output?.outputManifest,
      reason: `Operational worker entered ${progress.stage}.`,
    });
  };

  try {
    await executeClaimedOperationalJob({
      claimed,
      workerId,
      reportProgress,
      database,
      executors,
    });
    if (heartbeatError) throw heartbeatError;
    const completed = await getOperationalJob({ database, jobId: claimed.id });
    if (completed.job.status !== "succeeded") {
      throw new Error(
        "Release executor returned without atomically completing its job.",
      );
    }
    return {
      status: "succeeded",
      kind,
      jobId: claimed.id,
      attemptId: claimed.attemptId,
    };
  } catch (error) {
    if (error instanceof OperationalJobLeaseError) {
      return {
        status: "lease_lost",
        kind,
        jobId: claimed.id,
        attemptId: claimed.attemptId,
      };
    }
    const failure = isReleaseOperationalJobKind(claimed.kind)
      ? serializeReleaseJobExecutionError({
          error,
          stage: currentStage as ReleaseJobProgress["stage"] | null,
        })
      : serializeLifecycleCleanupExecutionError({
          error,
          stage: currentStage as LifecycleCleanupJobProgress["stage"] | null,
        });
    try {
      const updated = await failOperationalJobAttempt({
        database,
        jobId: claimed.id,
        leaseToken: claimed.leaseToken,
        workerId,
        error: failure,
        retryable: failure.retryable,
        reason: `Operational worker failed during ${failure.stage ?? "startup"}.`,
      });
      return {
        status:
          updated.status === "queued"
            ? "retried"
            : updated.status === "canceled"
              ? "canceled"
              : "failed",
        kind,
        jobId: claimed.id,
        attemptId: claimed.attemptId,
      };
    } catch (failureUpdateError) {
      if (failureUpdateError instanceof OperationalJobLeaseError) {
        return {
          status: "lease_lost",
          kind,
          jobId: claimed.id,
          attemptId: claimed.attemptId,
        };
      }
      throw failureUpdateError;
    }
  } finally {
    clearInterval(heartbeatInterval);
  }
};
