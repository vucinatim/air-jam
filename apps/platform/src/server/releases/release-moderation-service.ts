import { db } from "@/db";
import { gameReleaseChecks, gameReleases } from "@/db/schema";
import {
  captureReleaseScreenshot,
  type ReleaseScreenshotCaptureResult,
} from "@/server/releases/release-screenshot-service";
import {
  moderateReleaseScreenshot,
  type ReleaseImageModerationResult,
} from "@/server/releases/release-image-moderation-service";
import { eq } from "drizzle-orm";
import { getReleaseModerationAvailability } from "./release-moderation-config";
import { getReleaseStorage } from "./release-storage";

const SCREENSHOT_CAPTURE_KIND = "screenshot_capture";
const IMAGE_MODERATION_KIND = "image_moderation";

type ReleaseModerationSummary = {
  screenshot: ReleaseScreenshotCaptureResult | null;
  moderation: ReleaseImageModerationResult | null;
  skipped: boolean;
  reason: string | null;
};

const insertReleaseCheck = async ({
  releaseId,
  kind,
  status,
  summary,
  payload,
}: {
  releaseId: string;
  kind: "screenshot_capture" | "image_moderation";
  status: "passed" | "failed" | "warning";
  summary: string;
  payload: Record<string, unknown>;
}) =>
  db.insert(gameReleaseChecks).values({
    id: crypto.randomUUID(),
    releaseId,
    kind,
    status,
    summary,
    payload,
  });

const insertFailedReleaseCheck = async ({
  releaseId,
  kind,
  error,
}: {
  releaseId: string;
  kind: "screenshot_capture" | "image_moderation";
  error: unknown;
}) =>
  insertReleaseCheck({
    releaseId,
    kind,
    status: "failed",
    summary:
      error instanceof Error ? error.message : "The release check failed.",
    payload: {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
            }
          : {
              message: "Unknown release moderation error.",
            },
    },
  });

const insertSkippedReleaseCheck = async ({
  releaseId,
  kind,
  reason,
}: {
  releaseId: string;
  kind: "screenshot_capture" | "image_moderation";
  reason: string;
}) =>
  insertReleaseCheck({
    releaseId,
    kind,
    status: "warning",
    summary: reason,
    payload: {
      skipped: true,
      reason,
    },
  });

export const runReleaseModeration = async ({
  releaseId,
}: {
  releaseId: string;
}): Promise<ReleaseModerationSummary> => {
  const release = await db.query.gameReleases.findFirst({
    where: (table, { eq }) => eq(table.id, releaseId),
  });

  if (!release) {
    throw new Error("Release not found.");
  }

  if (!["ready", "quarantined", "live"].includes(release.status)) {
    throw new Error(
      "Release moderation can only run against ready, quarantined, or live releases.",
    );
  }

  const artifact = await db.query.gameReleaseArtifacts.findFirst({
    where: (table, { eq }) => eq(table.releaseId, releaseId),
  });

  if (!artifact) {
    throw new Error("Release artifact metadata is missing.");
  }

  const moderationAvailability = getReleaseModerationAvailability();
  if (!moderationAvailability.available) {
    await Promise.all([
      insertSkippedReleaseCheck({
        releaseId,
        kind: SCREENSHOT_CAPTURE_KIND,
        reason: moderationAvailability.reason,
      }),
      insertSkippedReleaseCheck({
        releaseId,
        kind: IMAGE_MODERATION_KIND,
        reason: moderationAvailability.reason,
      }),
    ]);

    return {
      screenshot: null,
      moderation: null,
      skipped: true,
      reason: moderationAvailability.reason,
    };
  }

  let screenshot: ReleaseScreenshotCaptureResult;
  try {
    screenshot = await captureReleaseScreenshot({
      gameId: release.gameId,
      releaseId: release.id,
      entryPath: artifact.entryPath,
    });
  } catch (error) {
    await insertFailedReleaseCheck({
      releaseId,
      kind: SCREENSHOT_CAPTURE_KIND,
      error,
    });
    throw error;
  }

  await insertReleaseCheck({
    releaseId,
    kind: SCREENSHOT_CAPTURE_KIND,
    status: "passed",
    summary: "Captured the canonical moderation screenshot for this release.",
    payload: {
      screenshotObjectKey: screenshot.screenshotObjectKey,
      contentType: screenshot.contentType,
      sizeBytes: screenshot.sizeBytes,
      width: screenshot.width,
      height: screenshot.height,
    },
  });

  let moderation: ReleaseImageModerationResult;
  try {
    const screenshotBuffer = await getReleaseStorage().readObject(
      screenshot.screenshotObjectKey,
    );
    moderation = await moderateReleaseScreenshot({
      screenshotBuffer,
    });
  } catch (error) {
    await insertFailedReleaseCheck({
      releaseId,
      kind: IMAGE_MODERATION_KIND,
      error,
    });
    throw error;
  }

  if (moderation.flagged) {
    await db.transaction(async (tx) => {
      await tx.insert(gameReleaseChecks).values({
        id: crypto.randomUUID(),
        releaseId,
        kind: IMAGE_MODERATION_KIND,
        status: "failed",
        summary:
          "Automated image moderation flagged the canonical release screenshot.",
        payload: {
          flagged: moderation.flagged,
          categories: moderation.categories,
          categoryScores: moderation.categoryScores,
          screenshotObjectKey: screenshot.screenshotObjectKey,
        },
      });

      await tx
        .update(gameReleases)
        .set({
          status: "quarantined",
          quarantinedAt: new Date(),
        })
        .where(eq(gameReleases.id, releaseId));
    });

    throw new Error(
      "Automated image moderation flagged this release. It has been quarantined.",
    );
  }

  await insertReleaseCheck({
    releaseId,
    kind: IMAGE_MODERATION_KIND,
    status: "passed",
    summary: "Automated image moderation cleared the canonical release screenshot.",
    payload: {
      flagged: moderation.flagged,
      categories: moderation.categories,
      categoryScores: moderation.categoryScores,
      screenshotObjectKey: screenshot.screenshotObjectKey,
    },
  });

  return {
    screenshot,
    moderation,
    skipped: false,
    reason: null,
  };
};
