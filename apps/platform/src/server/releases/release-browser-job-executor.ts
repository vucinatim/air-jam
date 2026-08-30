import { db } from "@/db";
import {
  gameReleaseChecks,
  gameReleaseGenerations,
  gameReleases,
} from "@/db/schema";
import {
  completeOperationalJobInTransaction,
  enqueueOperationalJobInTransaction,
} from "@/server/jobs/operational-job-service";
import { assertOperationalJobAttemptAuthority } from "@/server/jobs/operational-job-worker-authority";
import {
  createReleaseImageModerationJobPayload,
  parseReleaseJobResult,
  releaseJobExecutionContractVersion,
  ReleaseJobExecutionError,
  type ReleaseJobProgress,
} from "@/server/jobs/release-job-contract";
import { and, eq } from "drizzle-orm";
import { getReleaseModerationAvailability } from "./release-moderation-config";
import {
  captureReleaseScreenshot,
  type ReleaseScreenshotCaptureResult,
} from "./release-screenshot-service";
import {
  buildReleaseGenerationScreenshotObjectKey,
  buildReleaseGenerationScreenshotRootKey,
} from "./release-storage-keys";

type ReleaseBrowserJobAttemptInput = {
  jobId: string;
  releaseId: string;
  generationId: string;
  gameId: string;
  attemptId: string;
  leaseToken: string;
  workerId: string;
  reportProgress: (
    progress: ReleaseJobProgress,
    output?: {
      outputRootKey?: string;
      outputManifest?: Record<string, unknown>;
    },
  ) => Promise<void>;
  database?: typeof db;
  capture?: typeof captureReleaseScreenshot;
};

const commitReleaseBrowserJobAttempt = async ({
  database,
  jobId,
  releaseId,
  generationId,
  leaseToken,
  workerId,
  screenshot,
}: {
  database: typeof db;
  jobId: string;
  releaseId: string;
  generationId: string;
  leaseToken: string;
  workerId: string;
  screenshot: ReleaseScreenshotCaptureResult;
}) =>
  database.transaction(async (tx) => {
    const { job, attempt } = await assertOperationalJobAttemptAuthority({
      tx,
      jobId,
      leaseToken,
      workerId,
      expectedKind: "release_browser_validation",
      expectedGenerationId: generationId,
    });
    const [release] = await tx
      .select()
      .from(gameReleases)
      .where(eq(gameReleases.id, releaseId))
      .for("update");
    const [generation] = await tx
      .select()
      .from(gameReleaseGenerations)
      .where(
        and(
          eq(gameReleaseGenerations.id, generationId),
          eq(gameReleaseGenerations.releaseId, releaseId),
        ),
      )
      .for("update");
    if (
      !release ||
      !generation ||
      release.status !== "checking" ||
      release.candidateGenerationId !== generationId ||
      release.promotedGenerationId !== generationId ||
      generation.status !== "ready"
    ) {
      throw new Error("Release generation lost browser-validation authority.");
    }

    const downstream = await enqueueOperationalJobInTransaction({
      tx,
      kind: "release_image_moderation",
      creatorId: job.creatorId,
      gameId: job.gameId,
      releaseId: job.releaseId,
      generationId: job.generationId,
      idempotencyKey: `release-moderation:${job.generationId}:after:${job.id}`,
      payload: createReleaseImageModerationJobPayload({
        generationId: job.generationId,
        screenshot: {
          captureId: screenshot.captureId,
          objectKey: screenshot.screenshotObjectKey,
          contentType: screenshot.contentType,
          sizeBytes: screenshot.sizeBytes,
          width: screenshot.width,
          height: screenshot.height,
        },
      }),
      correlationId: job.correlationId,
      actor: workerId,
      reason: "Browser validation captured an immutable release screenshot.",
    });
    await tx.insert(gameReleaseChecks).values({
      id: crypto.randomUUID(),
      releaseId,
      generationId,
      jobId: job.id,
      jobAttempt: attempt.attempt,
      kind: "screenshot_capture",
      status: "passed",
      summary:
        "Captured an immutable moderation screenshot for this generation.",
      payload: {
        generationId,
        captureId: screenshot.captureId,
        contentType: screenshot.contentType,
        sizeBytes: screenshot.sizeBytes,
        width: screenshot.width,
        height: screenshot.height,
        nextJobId: downstream.job.id,
      },
    });
    const result = parseReleaseJobResult("release_browser_validation", {
      contractVersion: releaseJobExecutionContractVersion,
      generationId,
      screenshot: {
        captureId: screenshot.captureId,
        objectKey: screenshot.screenshotObjectKey,
        contentType: screenshot.contentType,
        sizeBytes: screenshot.sizeBytes,
        width: screenshot.width,
        height: screenshot.height,
      },
      nextJobId: downstream.job.id,
    });
    await completeOperationalJobInTransaction({
      tx,
      jobId: job.id,
      leaseToken,
      workerId,
      result,
      reason:
        "Release worker atomically committed screenshot evidence and its job result.",
    });
    return result;
  });

export const executeReleaseBrowserJobAttempt = async ({
  jobId,
  releaseId,
  generationId,
  gameId,
  attemptId,
  leaseToken,
  workerId,
  reportProgress,
  database = db,
  capture = captureReleaseScreenshot,
}: ReleaseBrowserJobAttemptInput) => {
  const availability = getReleaseModerationAvailability();
  if (!availability.available) {
    throw new ReleaseJobExecutionError({
      code: "browser_validation_unavailable",
      message: availability.reason,
      retryable: false,
      stage: "launching_browser",
    });
  }
  const screenshotRootKey = buildReleaseGenerationScreenshotRootKey({
    gameId,
    releaseId,
    generationId,
    captureId: attemptId,
  });
  const expectedScreenshotObjectKey = buildReleaseGenerationScreenshotObjectKey(
    {
      gameId,
      releaseId,
      generationId,
      captureId: attemptId,
    },
  );
  await reportProgress(
    {
      contractVersion: releaseJobExecutionContractVersion,
      stage: "launching_browser",
      message: "Launching the isolated release browser session.",
    },
    { outputRootKey: screenshotRootKey },
  );
  await reportProgress({
    contractVersion: releaseJobExecutionContractVersion,
    stage: "capturing_screenshot",
    message: "Capturing the promoted generation for moderation.",
  });
  const screenshot = await capture({
    gameId,
    releaseId,
    generationId,
    captureId: attemptId,
  });
  if (
    screenshot.generationId !== generationId ||
    screenshot.captureId !== attemptId ||
    screenshot.screenshotObjectKey !== expectedScreenshotObjectKey
  ) {
    throw new ReleaseJobExecutionError({
      code: "browser_capture_scope_mismatch",
      message:
        "Browser capture returned screenshot evidence outside the current job attempt scope.",
      retryable: false,
      stage: "capturing_screenshot",
    });
  }
  const outputManifest = {
    contractVersion: releaseJobExecutionContractVersion,
    kind: "release_screenshot",
    generationId,
    objectKey: screenshot.screenshotObjectKey,
    contentType: screenshot.contentType,
    sizeBytes: screenshot.sizeBytes,
    width: screenshot.width,
    height: screenshot.height,
  };
  await reportProgress(
    {
      contractVersion: releaseJobExecutionContractVersion,
      stage: "committing",
      message: "Committing screenshot evidence and enqueueing moderation.",
    },
    { outputRootKey: screenshotRootKey, outputManifest },
  );
  const committed = await commitReleaseBrowserJobAttempt({
    database,
    jobId,
    releaseId,
    generationId,
    leaseToken,
    workerId,
    screenshot,
  });
  return committed;
};
