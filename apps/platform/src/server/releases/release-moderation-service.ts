import { db } from "@/db";
import { gameReleaseChecks } from "@/db/schema";
import { assertOperationalLaneAccepting } from "@/server/operations/production-control-service";
import {
  moderateReleaseScreenshot,
  type ReleaseImageModerationResult,
} from "@/server/releases/release-image-moderation-service";
import {
  captureReleaseScreenshot,
  type ReleaseScreenshotCaptureResult,
} from "@/server/releases/release-screenshot-service";
import { getReleaseModerationAvailability } from "./release-moderation-config";
import { getReleaseStorage } from "./release-storage";

const SCREENSHOT_CAPTURE_KIND = "screenshot_capture";
const IMAGE_MODERATION_KIND = "image_moderation";

export type ReleaseModerationSummary = {
  generationId: string;
  screenshot: ReleaseScreenshotCaptureResult | null;
  moderation: ReleaseImageModerationResult | null;
  skipped: boolean;
  reason: string | null;
  outcome: "passed" | "skipped" | "flagged" | "disabled";
};

const insertReleaseCheck = async ({
  releaseId,
  generationId,
  kind,
  status,
  summary,
  payload,
}: {
  releaseId: string;
  generationId: string;
  kind: "screenshot_capture" | "image_moderation";
  status: "passed" | "failed" | "warning";
  summary: string;
  payload: Record<string, unknown>;
}) =>
  db.insert(gameReleaseChecks).values({
    id: crypto.randomUUID(),
    releaseId,
    generationId,
    kind,
    status,
    summary,
    payload,
  });

const insertFailedReleaseCheck = async ({
  releaseId,
  generationId,
  kind,
  error,
}: {
  releaseId: string;
  generationId: string;
  kind: "screenshot_capture" | "image_moderation";
  error: unknown;
}) =>
  insertReleaseCheck({
    releaseId,
    generationId,
    kind,
    status: "failed",
    summary:
      error instanceof Error ? error.message : "The release check failed.",
    payload: {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: "Unknown release moderation error." },
    },
  });

const insertSkippedReleaseCheck = async ({
  releaseId,
  generationId,
  kind,
  reason,
}: {
  releaseId: string;
  generationId: string;
  kind: "screenshot_capture" | "image_moderation";
  reason: string;
}) =>
  insertReleaseCheck({
    releaseId,
    generationId,
    kind,
    status: "warning",
    summary: reason,
    payload: { skipped: true, reason },
  });

export const runReleaseModeration = async ({
  releaseId,
  generationId,
}: {
  releaseId: string;
  generationId: string;
}): Promise<ReleaseModerationSummary> => {
  await assertOperationalLaneAccepting({ lane: "browser_validation" });
  const release = await db.query.gameReleases.findFirst({
    where: (table, { eq }) => eq(table.id, releaseId),
  });

  if (!release) {
    throw new Error("Release not found.");
  }

  if (!["checking", "ready", "quarantined", "live"].includes(release.status)) {
    throw new Error(
      "Release moderation can only run against checking, ready, quarantined, or live releases.",
    );
  }

  const generation = await db.query.gameReleaseGenerations.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, generationId), eq(table.releaseId, releaseId)),
  });

  if (
    !generation ||
    generation.status !== "ready" ||
    release.promotedGenerationId !== generationId
  ) {
    throw new Error("Promoted release generation is missing or not ready.");
  }

  const moderationAvailability = getReleaseModerationAvailability();
  if (!moderationAvailability.available) {
    await Promise.all([
      insertSkippedReleaseCheck({
        releaseId,
        generationId,
        kind: SCREENSHOT_CAPTURE_KIND,
        reason: moderationAvailability.reason,
      }),
      insertSkippedReleaseCheck({
        releaseId,
        generationId,
        kind: IMAGE_MODERATION_KIND,
        reason: moderationAvailability.reason,
      }),
    ]);

    return {
      generationId,
      screenshot: null,
      moderation: null,
      skipped: true,
      reason: moderationAvailability.reason,
      outcome: "skipped",
    };
  }

  let screenshot: ReleaseScreenshotCaptureResult;
  try {
    screenshot = await captureReleaseScreenshot({
      gameId: release.gameId,
      releaseId: release.id,
      generationId,
    });
  } catch (error) {
    await insertFailedReleaseCheck({
      releaseId,
      generationId,
      kind: SCREENSHOT_CAPTURE_KIND,
      error,
    });
    throw error;
  }

  await insertReleaseCheck({
    releaseId,
    generationId,
    kind: SCREENSHOT_CAPTURE_KIND,
    status: "passed",
    summary: "Captured an immutable moderation screenshot for this generation.",
    payload: {
      captureId: screenshot.captureId,
      screenshotObjectKey: screenshot.screenshotObjectKey,
      contentType: screenshot.contentType,
      sizeBytes: screenshot.sizeBytes,
      width: screenshot.width,
      height: screenshot.height,
    },
  });

  if (moderationAvailability.config.imageModeration.mode === "disabled") {
    const reason =
      "Automated image moderation is disabled for this environment; screenshot capture still completed.";

    await insertSkippedReleaseCheck({
      releaseId,
      generationId,
      kind: IMAGE_MODERATION_KIND,
      reason,
    });

    return {
      generationId,
      screenshot,
      moderation: null,
      skipped: false,
      reason,
      outcome: "disabled",
    };
  }

  await assertOperationalLaneAccepting({ lane: "moderation" });

  let moderation: ReleaseImageModerationResult;
  try {
    const screenshotBuffer = await getReleaseStorage().readObject(
      screenshot.screenshotObjectKey,
    );
    moderation = await moderateReleaseScreenshot({ screenshotBuffer });
  } catch (error) {
    await insertFailedReleaseCheck({
      releaseId,
      generationId,
      kind: IMAGE_MODERATION_KIND,
      error,
    });
    throw error;
  }

  if (moderation.flagged) {
    await insertReleaseCheck({
      releaseId,
      generationId,
      kind: IMAGE_MODERATION_KIND,
      status: "failed",
      summary:
        "Automated image moderation flagged the immutable generation screenshot.",
      payload: {
        flagged: moderation.flagged,
        categories: moderation.categories,
        categoryScores: moderation.categoryScores,
        screenshotObjectKey: screenshot.screenshotObjectKey,
      },
    });

    return {
      generationId,
      screenshot,
      moderation,
      skipped: false,
      reason: null,
      outcome: "flagged",
    };
  }

  await insertReleaseCheck({
    releaseId,
    generationId,
    kind: IMAGE_MODERATION_KIND,
    status: "passed",
    summary:
      "Automated image moderation cleared the immutable generation screenshot.",
    payload: {
      flagged: moderation.flagged,
      categories: moderation.categories,
      categoryScores: moderation.categoryScores,
      screenshotObjectKey: screenshot.screenshotObjectKey,
    },
  });

  return {
    generationId,
    screenshot,
    moderation,
    skipped: false,
    reason: null,
    outcome: "passed",
  };
};
