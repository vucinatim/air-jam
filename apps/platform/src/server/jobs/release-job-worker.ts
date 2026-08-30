import { db } from "@/db";
import { executeReleaseArtifactJobAttempt } from "@/server/releases/release-artifact-service";
import { executeReleaseBrowserJobAttempt } from "@/server/releases/release-browser-job-executor";
import { executeReleaseModerationJobAttempt } from "@/server/releases/release-moderation-job-executor";
import type { OperationalJobKind } from "@air-jam/database-contract";
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
  parseReleaseJobPayload,
  releaseJobProgressSchema,
  serializeReleaseJobExecutionError,
  type ReleaseJobProgress,
} from "./release-job-contract";

export const releaseJobWorkerKinds = Object.freeze([
  "release_artifact_processing",
  "release_browser_validation",
  "release_image_moderation",
] satisfies OperationalJobKind[]);

export type ReleaseJobWorkerCycleResult =
  | { status: "idle"; kind: OperationalJobKind }
  | {
      status: "succeeded" | "retried" | "failed" | "canceled" | "lease_lost";
      kind: OperationalJobKind;
      jobId: string;
      attemptId: string;
    };

export type ReleaseJobExecutors = Readonly<{
  artifact: typeof executeReleaseArtifactJobAttempt;
  browser: typeof executeReleaseBrowserJobAttempt;
  moderation: typeof executeReleaseModerationJobAttempt;
}>;

export const releaseJobExecutors: ReleaseJobExecutors = Object.freeze({
  artifact: executeReleaseArtifactJobAttempt,
  browser: executeReleaseBrowserJobAttempt,
  moderation: executeReleaseModerationJobAttempt,
});

const executeClaimedReleaseJob = async ({
  claimed,
  workerId,
  reportProgress,
  database,
  executors,
}: {
  claimed: NonNullable<Awaited<ReturnType<typeof claimOperationalJob>>>;
  workerId: string;
  reportProgress: (
    progress: ReleaseJobProgress,
    output?: {
      outputRootKey?: string;
      outputManifest?: Record<string, unknown>;
    },
  ) => Promise<void>;
  database: JobDatabase;
  executors: ReleaseJobExecutors;
}) => {
  switch (claimed.kind) {
    case "release_artifact_processing": {
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
  }
};

export const runReleaseJobWorkerCycle = async ({
  kind,
  workerId,
  database = db,
  executors = releaseJobExecutors,
}: {
  kind: OperationalJobKind;
  workerId: string;
  database?: JobDatabase;
  executors?: ReleaseJobExecutors;
}): Promise<ReleaseJobWorkerCycleResult> => {
  const claimed = await claimOperationalJob({ database, kind, workerId });
  if (!claimed) return { status: "idle", kind };
  if (!claimed.leaseToken) {
    throw new Error("Claimed release job did not include a lease token.");
  }

  let currentStage: ReleaseJobProgress["stage"] | null = null;
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
    rawProgress: ReleaseJobProgress,
    output?: {
      outputRootKey?: string;
      outputManifest?: Record<string, unknown>;
    },
  ) => {
    if (heartbeatError) throw heartbeatError;
    const progress = releaseJobProgressSchema.parse(rawProgress);
    currentStage = progress.stage;
    await recordOperationalJobStage({
      database,
      jobId: claimed.id,
      leaseToken: claimed.leaseToken!,
      workerId,
      progress,
      outputRootKey: output?.outputRootKey,
      outputManifest: output?.outputManifest,
      reason: `Release worker entered ${progress.stage}.`,
    });
  };

  try {
    await executeClaimedReleaseJob({
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
    const failure = serializeReleaseJobExecutionError({
      error,
      stage: currentStage,
    });
    try {
      const updated = await failOperationalJobAttempt({
        database,
        jobId: claimed.id,
        leaseToken: claimed.leaseToken,
        workerId,
        error: failure,
        retryable: failure.retryable,
        reason: `Release worker failed during ${failure.stage ?? "startup"}.`,
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
