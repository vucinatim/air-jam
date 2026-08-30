import { db } from "@/db";
import {
  gameReleaseChecks,
  gameReleaseGenerations,
  gameReleases,
} from "@/db/schema";
import { completeOperationalJobInTransaction } from "@/server/jobs/operational-job-service";
import { assertOperationalJobAttemptAuthority } from "@/server/jobs/operational-job-worker-authority";
import {
  parseReleaseJobResult,
  releaseJobExecutionContractVersion,
  ReleaseJobExecutionError,
  type ReleaseJobProgress,
} from "@/server/jobs/release-job-contract";
import { and, eq } from "drizzle-orm";
import {
  moderateReleaseScreenshot,
  type ReleaseImageModerationResult,
} from "./release-image-moderation-service";
import { getReleaseModerationAvailability } from "./release-moderation-config";
import { getReleaseStorage, type ReleaseStorage } from "./release-storage";
import { buildReleaseGenerationScreenshotObjectKey } from "./release-storage-keys";

type ReleaseModerationJobAttemptInput = {
  jobId: string;
  releaseId: string;
  generationId: string;
  gameId: string;
  leaseToken: string;
  workerId: string;
  screenshot: {
    captureId: string;
    objectKey: string;
    contentType: "image/png";
    sizeBytes: number;
    width: number;
    height: number;
  };
  reportProgress: (progress: ReleaseJobProgress) => Promise<void>;
  database?: typeof db;
  storage?: ReleaseStorage;
  moderate?: typeof moderateReleaseScreenshot;
};

const commitReleaseModerationJobAttempt = async ({
  database,
  jobId,
  releaseId,
  generationId,
  leaseToken,
  workerId,
  moderation,
  provider,
  model,
}: {
  database: typeof db;
  jobId: string;
  releaseId: string;
  generationId: string;
  leaseToken: string;
  workerId: string;
  moderation: ReleaseImageModerationResult;
  provider: string | null;
  model: string | null;
}) =>
  database.transaction(async (tx) => {
    const { authorityNow, job, attempt } =
      await assertOperationalJobAttemptAuthority({
        tx,
        jobId,
        leaseToken,
        workerId,
        expectedKind: "release_image_moderation",
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
      throw new Error("Release generation lost moderation authority.");
    }

    const decision = moderation.flagged ? "quarantined" : "ready";
    const [updatedRelease] = await tx
      .update(gameReleases)
      .set({
        status: decision,
        candidateGenerationId: null,
        checkedAt: authorityNow,
        quarantinedAt: decision === "quarantined" ? authorityNow : null,
      })
      .where(
        and(
          eq(gameReleases.id, releaseId),
          eq(gameReleases.status, "checking"),
          eq(gameReleases.candidateGenerationId, generationId),
          eq(gameReleases.promotedGenerationId, generationId),
        ),
      )
      .returning();
    if (!updatedRelease) {
      throw new Error("Release changed during moderation commit.");
    }

    await tx.insert(gameReleaseChecks).values({
      id: crypto.randomUUID(),
      releaseId,
      generationId,
      jobId: job.id,
      jobAttempt: attempt.attempt,
      kind: "image_moderation",
      status: moderation.flagged ? "failed" : "passed",
      summary: moderation.flagged
        ? "Automated image moderation flagged the immutable generation screenshot."
        : provider
          ? "Automated image moderation cleared the immutable generation screenshot."
          : "Image moderation is disabled; screenshot validation completed.",
      payload: {
        decision,
        provider,
        model,
        flagged: moderation.flagged,
        categories: moderation.categories,
        categoryScores: moderation.categoryScores,
      },
    });
    const result = parseReleaseJobResult("release_image_moderation", {
      contractVersion: releaseJobExecutionContractVersion,
      generationId,
      decision,
      provider,
      model,
    });
    await completeOperationalJobInTransaction({
      tx,
      jobId: job.id,
      leaseToken,
      workerId,
      result,
      reason:
        "Release worker atomically committed moderation evidence and its job result.",
    });
    return result;
  });

export const executeReleaseModerationJobAttempt = async ({
  jobId,
  releaseId,
  generationId,
  gameId,
  leaseToken,
  workerId,
  screenshot,
  reportProgress,
  database = db,
  storage,
  moderate = moderateReleaseScreenshot,
}: ReleaseModerationJobAttemptInput) => {
  const expectedScreenshotObjectKey = buildReleaseGenerationScreenshotObjectKey(
    {
      gameId,
      releaseId,
      generationId,
      captureId: screenshot.captureId,
    },
  );
  if (screenshot.objectKey !== expectedScreenshotObjectKey) {
    throw new ReleaseJobExecutionError({
      code: "moderation_screenshot_scope_mismatch",
      message:
        "Moderation screenshot is outside the immutable generation capture scope.",
      retryable: false,
      stage: "reading_screenshot",
    });
  }
  await reportProgress({
    contractVersion: releaseJobExecutionContractVersion,
    stage: "reading_screenshot",
    message: "Reading immutable screenshot evidence for moderation.",
  });
  const availability = getReleaseModerationAvailability();
  if (!availability.available) {
    throw new ReleaseJobExecutionError({
      code: "image_moderation_unavailable",
      message: availability.reason,
      retryable: false,
      stage: "reading_screenshot",
    });
  }
  let moderation: ReleaseImageModerationResult;
  let provider: string | null = null;
  let model: string | null = null;
  if (availability.config.imageModeration.mode === "disabled") {
    moderation = { flagged: false, categories: {}, categoryScores: {} };
  } else {
    await reportProgress({
      contractVersion: releaseJobExecutionContractVersion,
      stage: "moderating_image",
      message: "Submitting screenshot evidence to the configured moderator.",
    });
    const screenshotBuffer = await (storage ?? getReleaseStorage()).readObject(
      screenshot.objectKey,
    );
    if (screenshotBuffer.byteLength !== screenshot.sizeBytes) {
      throw new ReleaseJobExecutionError({
        code: "moderation_screenshot_size_mismatch",
        message: "Screenshot size changed after browser validation.",
        retryable: false,
        stage: "reading_screenshot",
      });
    }
    moderation = await moderate({ screenshotBuffer });
    provider = "openai";
    model = availability.config.imageModeration.openAi?.model ?? null;
  }

  await reportProgress({
    contractVersion: releaseJobExecutionContractVersion,
    stage: "committing",
    message: "Committing moderation evidence and final release status.",
  });
  const committed = await commitReleaseModerationJobAttempt({
    database,
    jobId,
    releaseId,
    generationId,
    leaseToken,
    workerId,
    moderation,
    provider,
    model,
  });
  return committed;
};
