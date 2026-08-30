import {
  gameReleaseChecks,
  gameReleaseGenerations,
  gameReleases,
} from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import type {
  JobTransaction,
  OperationalJob,
} from "./operational-job-internals";
import { OperationalJobConflictError } from "./operational-job-internals";

const checkKindByJobKind = Object.freeze({
  release_artifact_processing: "artifact_validation",
  release_browser_validation: "screenshot_capture",
  release_image_moderation: "image_moderation",
} as const);

export const applyReleaseJobTerminalState = async ({
  tx,
  job,
  now,
}: {
  tx: JobTransaction;
  job: OperationalJob;
  now: Date;
}) => {
  if (job.status !== "failed" && job.status !== "canceled") return false;
  const existingCheck = await tx.query.gameReleaseChecks.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.jobId, job.id),
        eq(table.kind, checkKindByJobKind[job.kind]),
      ),
  });
  if (existingCheck) return false;

  const [release] = await tx
    .select()
    .from(gameReleases)
    .where(eq(gameReleases.id, job.releaseId))
    .for("update");
  const [generation] = await tx
    .select()
    .from(gameReleaseGenerations)
    .where(
      and(
        eq(gameReleaseGenerations.id, job.generationId),
        eq(gameReleaseGenerations.releaseId, job.releaseId),
      ),
    )
    .for("update");
  if (!release || !generation) return false;

  const isCurrentCandidate = release.candidateGenerationId === job.generationId;
  if (
    job.kind === "release_artifact_processing" &&
    isCurrentCandidate &&
    ["awaiting_upload", "processing"].includes(generation.status)
  ) {
    await tx
      .update(gameReleaseGenerations)
      .set(
        job.status === "canceled"
          ? { status: "abandoned", abandonedAt: now }
          : { status: "failed", failedAt: now },
      )
      .where(
        and(
          eq(gameReleaseGenerations.id, job.generationId),
          inArray(gameReleaseGenerations.status, [
            "awaiting_upload",
            "processing",
          ]),
        ),
      );
    await tx
      .update(gameReleases)
      .set({
        status: "failed",
        candidateGenerationId: null,
        checkedAt: now,
      })
      .where(
        and(
          eq(gameReleases.id, job.releaseId),
          eq(gameReleases.candidateGenerationId, job.generationId),
        ),
      );
  } else if (
    job.kind !== "release_artifact_processing" &&
    isCurrentCandidate &&
    release.promotedGenerationId === job.generationId &&
    release.status === "checking"
  ) {
    await tx
      .update(gameReleases)
      .set({
        status: "failed",
        candidateGenerationId: null,
        checkedAt: now,
      })
      .where(
        and(
          eq(gameReleases.id, job.releaseId),
          eq(gameReleases.status, "checking"),
          eq(gameReleases.candidateGenerationId, job.generationId),
          eq(gameReleases.promotedGenerationId, job.generationId),
        ),
      );
  }

  if (job.attemptCount > 0) {
    const errorCode =
      job.lastError && typeof job.lastError.code === "string"
        ? job.lastError.code
        : job.status === "canceled"
          ? "canceled"
          : "executor_failed";
    await tx.insert(gameReleaseChecks).values({
      id: crypto.randomUUID(),
      releaseId: job.releaseId,
      generationId: job.generationId,
      jobId: job.id,
      jobAttempt: job.attemptCount,
      kind: checkKindByJobKind[job.kind],
      status: job.status === "canceled" ? "warning" : "failed",
      summary:
        job.status === "canceled"
          ? "Release processing was canceled before completion."
          : `Release processing failed with ${errorCode}.`,
      payload: {
        error: job.lastError,
        terminalJobStatus: job.status,
      },
      createdAt: now,
    });
  }
  return true;
};

export const prepareReleaseJobReplayState = async ({
  tx,
  job,
  now,
}: {
  tx: JobTransaction;
  job: OperationalJob;
  now: Date;
}) => {
  if (job.status !== "failed" && job.status !== "canceled") {
    throw new OperationalJobConflictError(
      "Only failed or canceled release jobs can be replayed.",
    );
  }
  const [release] = await tx
    .select()
    .from(gameReleases)
    .where(eq(gameReleases.id, job.releaseId))
    .for("update");
  const [generation] = await tx
    .select()
    .from(gameReleaseGenerations)
    .where(
      and(
        eq(gameReleaseGenerations.id, job.generationId),
        eq(gameReleaseGenerations.releaseId, job.releaseId),
      ),
    )
    .for("update");
  if (!release || !generation) {
    throw new OperationalJobConflictError(
      "Release replay scope no longer exists.",
    );
  }

  if (job.kind === "release_artifact_processing") {
    if (
      release.status !== "failed" ||
      release.candidateGenerationId !== null ||
      !["failed", "abandoned"].includes(generation.status)
    ) {
      throw new OperationalJobConflictError(
        "Artifact replay requires its terminal generation and failed release state.",
      );
    }
    const observed = Boolean(generation.observedEtag);
    await tx
      .update(gameReleaseGenerations)
      .set({
        status: observed ? "processing" : "awaiting_upload",
        failedAt: null,
        abandonedAt: null,
        processingStartedAt: observed
          ? (generation.processingStartedAt ?? now)
          : null,
      })
      .where(eq(gameReleaseGenerations.id, generation.id));
    await tx
      .update(gameReleases)
      .set({
        status: observed ? "checking" : "uploading",
        candidateGenerationId: generation.id,
        checkedAt: null,
      })
      .where(eq(gameReleases.id, release.id));
    return;
  }

  if (
    release.status !== "failed" ||
    release.candidateGenerationId !== null ||
    release.promotedGenerationId !== generation.id ||
    generation.status !== "ready"
  ) {
    throw new OperationalJobConflictError(
      "Validation replay requires the failed release's promoted ready generation.",
    );
  }
  await tx
    .update(gameReleases)
    .set({
      status: "checking",
      candidateGenerationId: generation.id,
      checkedAt: null,
    })
    .where(eq(gameReleases.id, release.id));
};
