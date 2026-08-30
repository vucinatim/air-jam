import { db } from "@/db";
import {
  gameReleaseChecks,
  gameReleaseGenerations,
  gameReleases,
} from "@/db/schema";
import {
  MAX_RELEASE_ZIP_BYTES,
  RELEASE_UPLOAD_CONTENT_TYPE,
  RELEASE_UPLOAD_FILENAME_EXTENSION,
} from "@/lib/releases/release-policy";
import {
  completeOperationalJobInTransaction,
  enqueueOperationalJobInTransaction,
  supersedeOperationalJobsForGenerationInTransaction,
} from "@/server/jobs/operational-job-service";
import { assertOperationalJobAttemptAuthority } from "@/server/jobs/operational-job-worker-authority";
import {
  createReleaseBrowserValidationJobPayload,
  parseReleaseJobResult,
  releaseJobExecutionContractVersion,
  ReleaseJobExecutionError,
  type ReleaseJobProgress,
} from "@/server/jobs/release-job-contract";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import type { assertOwnedRelease } from "./assert-owned-release";
import {
  readReleaseArchiveManifest,
  streamValidatedReleaseArchiveFiles,
} from "./release-artifact-validation";
import {
  getReleaseStorage,
  type ReleaseStorage,
  type ReleaseStoredObjectHead,
} from "./release-storage";
import {
  buildReleaseGenerationSiteRootKey,
  buildReleaseGenerationStorageKeys,
  buildReleaseSiteObjectKey,
} from "./release-storage-keys";

type OwnedRelease = Awaited<ReturnType<typeof assertOwnedRelease>>;
type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type RequestReleaseUploadTargetInput = {
  release: OwnedRelease;
  originalFilename: string;
  sizeBytes: number;
  actor: string;
  database?: typeof db;
  storage?: ReleaseStorage;
};

const ARTIFACT_VALIDATION_CHECK_KIND = "artifact_validation";
const RELEASE_UPLOAD_VISIBILITY_ATTEMPTS = 8;
const RELEASE_UPLOAD_VISIBILITY_DELAY_MS = 250;

class ReleaseUploadFactsValidationError extends ReleaseJobExecutionError {
  constructor(message: string) {
    super({
      code: "invalid_upload_facts",
      message,
      retryable: false,
      stage: "observing_upload",
    });
    this.name = "ReleaseUploadFactsValidationError";
  }
}

const trimFilename = (value: string): string => value.trim();

const assertValidReleaseUploadFilename = (filename: string): string => {
  const trimmedFilename = trimFilename(filename);
  if (!trimmedFilename) {
    throw new Error("Release upload filename is required.");
  }

  if (
    trimmedFilename.includes("/") ||
    trimmedFilename.includes("\\") ||
    trimmedFilename.includes("\0")
  ) {
    throw new Error("Release upload filename must be a plain file name.");
  }

  if (
    !trimmedFilename.toLowerCase().endsWith(RELEASE_UPLOAD_FILENAME_EXTENSION)
  ) {
    throw new Error("Release uploads must be .zip archives.");
  }

  return trimmedFilename;
};

const readStreamToBuffer = async (
  stream: Readable,
  maxBytes: number,
): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const bufferChunk = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += bufferChunk.length;

    if (totalBytes > maxBytes) {
      throw new Error(
        `Release archive file exceeded the ${maxBytes} byte upload limit during extraction.`,
      );
    }

    chunks.push(bufferChunk);
  }

  return Buffer.concat(chunks);
};

const wait = async (durationMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });

const waitForUploadedArtifact = async ({
  storage,
  zipObjectKey,
}: {
  storage: ReleaseStorage;
  zipObjectKey: string;
}) => {
  for (
    let attempt = 0;
    attempt < RELEASE_UPLOAD_VISIBILITY_ATTEMPTS;
    attempt += 1
  ) {
    const uploadedObject = await storage.headObject(zipObjectKey);
    if (uploadedObject) {
      return uploadedObject;
    }

    if (attempt < RELEASE_UPLOAD_VISIBILITY_ATTEMPTS - 1) {
      await wait(RELEASE_UPLOAD_VISIBILITY_DELAY_MS);
    }
  }

  return null;
};

const lockRelease = async (tx: DatabaseTransaction, releaseId: string) => {
  await tx.execute(
    sql`select ${gameReleases.id} from ${gameReleases} where ${gameReleases.id} = ${releaseId} for update`,
  );
};

const lockGeneration = async (
  tx: DatabaseTransaction,
  generationId: string,
) => {
  await tx.execute(
    sql`select ${gameReleaseGenerations.id} from ${gameReleaseGenerations} where ${gameReleaseGenerations.id} = ${generationId} for update`,
  );
};

export const requestReleaseUploadTarget = async ({
  release,
  originalFilename,
  sizeBytes,
  actor,
  database = db,
  storage = getReleaseStorage(),
}: RequestReleaseUploadTargetInput) => {
  if (
    !Number.isSafeInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > MAX_RELEASE_ZIP_BYTES
  ) {
    throw new Error(
      `Release archives must be between 1 byte and ${MAX_RELEASE_ZIP_BYTES} bytes.`,
    );
  }

  const validatedFilename = assertValidReleaseUploadFilename(originalFilename);
  const generationId = crypto.randomUUID();
  const { zipObjectKey } = buildReleaseGenerationStorageKeys({
    gameId: release.gameId,
    releaseId: release.id,
    generationId,
  });
  const upload = await storage.createArtifactUploadTarget({
    key: zipObjectKey,
    contentType: RELEASE_UPLOAD_CONTENT_TYPE,
    originalFilename: validatedFilename,
  });

  const generation = await database.transaction(async (tx) => {
    await lockRelease(tx, release.id);
    const authoritativeRelease = await tx.query.gameReleases.findFirst({
      where: (table, { eq }) => eq(table.id, release.id),
    });

    if (
      !authoritativeRelease ||
      !["draft", "uploading", "failed"].includes(authoritativeRelease.status)
    ) {
      throw new Error(
        "Only draft, uploading, or failed releases can request a new artifact generation.",
      );
    }

    if (authoritativeRelease.candidateGenerationId) {
      await supersedeOperationalJobsForGenerationInTransaction({
        tx,
        generationId: authoritativeRelease.candidateGenerationId,
        actor,
        reason: "A newer immutable upload generation superseded this work.",
      });
      await tx
        .update(gameReleaseGenerations)
        .set({
          status: "abandoned",
          abandonedAt: sql`clock_timestamp()`,
        })
        .where(
          and(
            eq(
              gameReleaseGenerations.id,
              authoritativeRelease.candidateGenerationId,
            ),
            inArray(gameReleaseGenerations.status, [
              "awaiting_upload",
              "processing",
            ]),
          ),
        );
    }

    const [sequenceRow] = await tx
      .select({
        value: sql<number>`coalesce(max(${gameReleaseGenerations.sequence}), 0) + 1`,
      })
      .from(gameReleaseGenerations)
      .where(eq(gameReleaseGenerations.releaseId, release.id));
    const sequence = Number(sequenceRow?.value ?? 1);

    const [createdGeneration] = await tx
      .insert(gameReleaseGenerations)
      .values({
        id: generationId,
        releaseId: release.id,
        sequence,
        status: "awaiting_upload",
        originalFilename: validatedFilename,
        contentType: RELEASE_UPLOAD_CONTENT_TYPE,
        declaredSizeBytes: sizeBytes,
        zipObjectKey,
      })
      .returning();

    if (!createdGeneration) {
      throw new Error("Release generation could not be created.");
    }

    await tx
      .update(gameReleases)
      .set({
        status: "uploading",
        candidateGenerationId: generationId,
        uploadedAt: null,
        checkedAt: null,
        quarantinedAt: null,
      })
      .where(eq(gameReleases.id, release.id));

    return createdGeneration;
  });

  return { generation, upload };
};

type ReleaseArtifactJobAttemptInput = {
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
  storage?: ReleaseStorage;
};

const assertUploadedObjectMatchesGeneration = ({
  generation,
  uploadedObject,
}: {
  generation: typeof gameReleaseGenerations.$inferSelect;
  uploadedObject: ReleaseStoredObjectHead;
}): void => {
  const observedFilename = uploadedObject.metadata["original-filename"];
  if (uploadedObject.sizeBytes !== generation.declaredSizeBytes) {
    throw new ReleaseUploadFactsValidationError(
      `Uploaded archive size ${uploadedObject.sizeBytes} did not match declared size ${generation.declaredSizeBytes}.`,
    );
  }
  if (uploadedObject.contentType !== generation.contentType) {
    throw new ReleaseUploadFactsValidationError(
      `Uploaded archive content type ${uploadedObject.contentType ?? "missing"} did not match ${generation.contentType}.`,
    );
  }
  if (observedFilename !== generation.originalFilename) {
    throw new ReleaseUploadFactsValidationError(
      "Uploaded archive filename metadata did not match its generation.",
    );
  }
  if (!uploadedObject.etag?.trim()) {
    throw new ReleaseUploadFactsValidationError(
      "Uploaded archive storage metadata did not include an ETag for a fenced read.",
    );
  }
};

const prepareReleaseGenerationJobAttempt = async ({
  database,
  jobId,
  releaseId,
  generationId,
  leaseToken,
  workerId,
  uploadedObject,
}: {
  database: typeof db;
  jobId: string;
  releaseId: string;
  generationId: string;
  leaseToken: string;
  workerId: string;
  uploadedObject: ReleaseStoredObjectHead;
}) =>
  database.transaction(async (tx) => {
    await assertOperationalJobAttemptAuthority({
      tx,
      jobId,
      leaseToken,
      workerId,
      expectedKind: "release_artifact_processing",
      expectedGenerationId: generationId,
    });
    await lockRelease(tx, releaseId);
    await lockGeneration(tx, generationId);
    const release = await tx.query.gameReleases.findFirst({
      where: (table, { eq }) => eq(table.id, releaseId),
    });
    const generation = await tx.query.gameReleaseGenerations.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, generationId), eq(table.releaseId, releaseId)),
    });

    if (!release || !generation) {
      throw new Error("Release generation was not found.");
    }
    if (
      release.candidateGenerationId !== generationId &&
      release.promotedGenerationId !== generationId
    ) {
      throw new Error("Release generation lost current-generation authority.");
    }

    assertUploadedObjectMatchesGeneration({ generation, uploadedObject });
    if (generation.status === "ready") {
      return generation;
    }
    if (generation.status === "processing") {
      if (
        generation.observedSizeBytes !== uploadedObject.sizeBytes ||
        generation.observedContentType !== uploadedObject.contentType ||
        generation.observedEtag !== uploadedObject.etag
      ) {
        throw new ReleaseUploadFactsValidationError(
          "Uploaded archive facts changed after the first processing attempt.",
        );
      }
      return generation;
    }
    if (
      generation.status !== "awaiting_upload" ||
      release.status !== "uploading" ||
      release.candidateGenerationId !== generationId
    ) {
      throw new Error(
        "Release generation is no longer eligible for processing.",
      );
    }

    const [processingGeneration] = await tx
      .update(gameReleaseGenerations)
      .set({
        status: "processing",
        observedSizeBytes: uploadedObject.sizeBytes,
        observedContentType: uploadedObject.contentType,
        observedEtag: uploadedObject.etag,
        observedLastModifiedAt: uploadedObject.lastModifiedAt,
        uploadObservedAt: sql`clock_timestamp()`,
        processingStartedAt: sql`clock_timestamp()`,
      })
      .where(
        and(
          eq(gameReleaseGenerations.id, generationId),
          eq(gameReleaseGenerations.status, "awaiting_upload"),
        ),
      )
      .returning();
    const [checkingRelease] = await tx
      .update(gameReleases)
      .set({ status: "checking" })
      .where(
        and(
          eq(gameReleases.id, releaseId),
          eq(gameReleases.status, "uploading"),
          eq(gameReleases.candidateGenerationId, generationId),
        ),
      )
      .returning();
    if (!processingGeneration || !checkingRelease) {
      throw new Error("Release generation changed while claiming processing.");
    }
    return processingGeneration;
  });

const commitReleaseArtifactJobAttempt = async ({
  database,
  jobId,
  releaseId,
  generationId,
  leaseToken,
  workerId,
  siteRootKey,
  contentHash,
  manifest,
}: {
  database: typeof db;
  jobId: string;
  releaseId: string;
  generationId: string;
  leaseToken: string;
  workerId: string;
  siteRootKey: string;
  contentHash: string;
  manifest: Awaited<ReturnType<typeof readReleaseArchiveManifest>>;
}) =>
  database.transaction(async (tx) => {
    const { job, attempt } = await assertOperationalJobAttemptAuthority({
      tx,
      jobId,
      leaseToken,
      workerId,
      expectedKind: "release_artifact_processing",
      expectedGenerationId: generationId,
    });
    await lockRelease(tx, releaseId);
    await lockGeneration(tx, generationId);
    const release = await tx.query.gameReleases.findFirst({
      where: (table, { eq }) => eq(table.id, releaseId),
    });
    const generation = await tx.query.gameReleaseGenerations.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, generationId), eq(table.releaseId, releaseId)),
    });
    if (!release || !generation) {
      throw new Error(
        "Release generation was not found during artifact commit.",
      );
    }

    if (generation.status !== "ready") {
      if (
        generation.status !== "processing" ||
        release.status !== "checking" ||
        release.candidateGenerationId !== generationId
      ) {
        throw new Error("Release generation lost artifact commit authority.");
      }
      const [readyGeneration] = await tx
        .update(gameReleaseGenerations)
        .set({
          status: "ready",
          siteRootKey,
          extractedSizeBytes: manifest.extractedSizeBytes,
          fileCount: manifest.fileCount,
          entryPath: manifest.entryPath,
          contentHash,
          readyAt: sql`clock_timestamp()`,
        })
        .where(
          and(
            eq(gameReleaseGenerations.id, generationId),
            eq(gameReleaseGenerations.status, "processing"),
          ),
        )
        .returning();
      if (!readyGeneration) {
        throw new Error("Release generation changed during artifact commit.");
      }

      const [promotedRelease] = await tx
        .update(gameReleases)
        .set({
          promotedGenerationId: generationId,
          uploadedAt: sql`clock_timestamp()`,
          checkedAt: null,
        })
        .where(
          and(
            eq(gameReleases.id, releaseId),
            eq(gameReleases.status, "checking"),
            eq(gameReleases.candidateGenerationId, generationId),
          ),
        )
        .returning();
      if (!promotedRelease) {
        throw new Error("Release changed during artifact commit.");
      }

      await tx.insert(gameReleaseChecks).values({
        id: crypto.randomUUID(),
        releaseId,
        generationId,
        jobId: job.id,
        jobAttempt: attempt.attempt,
        kind: ARTIFACT_VALIDATION_CHECK_KIND,
        status: "passed",
        summary: `Validated ${manifest.fileCount} files and extracted ${manifest.extractedSizeBytes} bytes.`,
        payload: {
          fileCount: manifest.fileCount,
          extractedSizeBytes: manifest.extractedSizeBytes,
          entryPath: manifest.entryPath,
          hostedManifest: manifest.hostedManifest,
          contentHash,
        },
      });
    } else if (
      generation.siteRootKey !== siteRootKey ||
      generation.contentHash !== contentHash
    ) {
      throw new Error(
        "Ready generation output does not match this job attempt output.",
      );
    }

    const downstream = await enqueueOperationalJobInTransaction({
      tx,
      kind: "release_browser_validation",
      creatorId: job.creatorId,
      gameId: job.gameId,
      releaseId,
      generationId,
      idempotencyKey: `release-browser:${generationId}:after:${job.id}`,
      payload: createReleaseBrowserValidationJobPayload({
        generationId,
      }),
      correlationId: job.correlationId,
      actor: workerId,
      reason: "Artifact processing committed an immutable release generation.",
    });
    const result = parseReleaseJobResult("release_artifact_processing", {
      contractVersion: releaseJobExecutionContractVersion,
      generationId,
      siteRootKey,
      contentHash,
      extractedSizeBytes: manifest.extractedSizeBytes,
      fileCount: manifest.fileCount,
      entryPath: manifest.entryPath,
      nextJobId: downstream.job.id,
    });
    await completeOperationalJobInTransaction({
      tx,
      jobId: job.id,
      leaseToken,
      workerId,
      result,
      reason:
        "Operational worker atomically committed artifact output and its job result.",
    });
    return result;
  });

export const executeReleaseArtifactJobAttempt = async ({
  jobId,
  releaseId,
  generationId,
  gameId,
  attemptId,
  leaseToken,
  workerId,
  reportProgress,
  database = db,
  storage = getReleaseStorage(),
}: ReleaseArtifactJobAttemptInput) => {
  await reportProgress({
    contractVersion: releaseJobExecutionContractVersion,
    stage: "observing_upload",
    message: "Waiting for the immutable upload object to become visible.",
  });
  const generation = await database.query.gameReleaseGenerations.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, generationId), eq(table.releaseId, releaseId)),
  });
  if (!generation) {
    throw new ReleaseJobExecutionError({
      code: "release_generation_missing",
      message: "Release generation was not found.",
      retryable: false,
      stage: "observing_upload",
    });
  }
  const uploadedObject = await waitForUploadedArtifact({
    storage,
    zipObjectKey: generation.zipObjectKey,
  });
  if (!uploadedObject) {
    throw new ReleaseJobExecutionError({
      code: "upload_not_visible",
      message: "Uploaded artifact was not found in release storage.",
      retryable: true,
      stage: "observing_upload",
    });
  }
  if (
    uploadedObject.sizeBytes <= 0 ||
    uploadedObject.sizeBytes > MAX_RELEASE_ZIP_BYTES
  ) {
    throw new ReleaseUploadFactsValidationError(
      `Uploaded archive exceeds the ${MAX_RELEASE_ZIP_BYTES} byte limit.`,
    );
  }

  const processingGeneration = await prepareReleaseGenerationJobAttempt({
    database,
    jobId,
    releaseId,
    generationId,
    leaseToken,
    workerId,
    uploadedObject,
  });
  if (!processingGeneration.observedEtag) {
    throw new ReleaseUploadFactsValidationError(
      "Processing generation is missing its observed ETag.",
    );
  }

  const siteRootKey =
    processingGeneration.siteRootKey ??
    buildReleaseGenerationSiteRootKey({
      gameId,
      releaseId,
      generationId,
      outputId: attemptId,
    });
  await reportProgress(
    {
      contractVersion: releaseJobExecutionContractVersion,
      stage: "reading_source",
      message: "Reading the upload with its first-observed ETag fence.",
    },
    { outputRootKey: siteRootKey },
  );
  const archiveBuffer = await storage.readObject(
    processingGeneration.zipObjectKey,
    { expectedEtag: processingGeneration.observedEtag },
  );
  const contentHash = createHash("sha256").update(archiveBuffer).digest("hex");

  await reportProgress({
    contractVersion: releaseJobExecutionContractVersion,
    stage: "validating_archive",
    message: "Validating archive paths, manifest, limits, and content types.",
  });
  let manifest: Awaited<ReturnType<typeof readReleaseArchiveManifest>>;
  try {
    manifest = await readReleaseArchiveManifest(archiveBuffer);
  } catch (cause) {
    throw new ReleaseJobExecutionError({
      code: "invalid_release_archive",
      message:
        cause instanceof Error
          ? cause.message
          : "Release archive validation failed.",
      retryable: false,
      stage: "validating_archive",
      cause,
    });
  }

  if (processingGeneration.status !== "ready") {
    await reportProgress({
      contractVersion: releaseJobExecutionContractVersion,
      stage: "writing_outputs",
      message: "Writing create-only files to the attempt-scoped output root.",
      completedUnits: 0,
      totalUnits: manifest.fileCount,
    });
    let completedFiles = 0;
    try {
      await streamValidatedReleaseArchiveFiles({
        archiveBuffer,
        files: manifest.files,
        onFile: async (file, stream) => {
          const body = await readStreamToBuffer(stream, file.sizeBytes);
          try {
            await storage.putObject({
              key: buildReleaseSiteObjectKey(siteRootKey, file.relativePath),
              body,
              contentType: file.contentType,
              cacheControl: file.cacheControl,
              writeMode: "create",
            });
          } catch (cause) {
            throw new ReleaseJobExecutionError({
              code: "release_output_write_failed",
              message: "Could not write an immutable release output object.",
              retryable: true,
              stage: "writing_outputs",
              cause,
            });
          }
          completedFiles += 1;
          if (
            completedFiles % 25 === 0 &&
            completedFiles < manifest.fileCount
          ) {
            await reportProgress({
              contractVersion: releaseJobExecutionContractVersion,
              stage: "writing_outputs",
              message:
                "Writing create-only files to the attempt-scoped output root.",
              completedUnits: completedFiles,
              totalUnits: manifest.fileCount,
            });
          }
        },
      });
    } catch (cause) {
      if (cause instanceof ReleaseJobExecutionError) throw cause;
      throw new ReleaseJobExecutionError({
        code: "invalid_release_archive",
        message:
          cause instanceof Error
            ? cause.message
            : "Release archive extraction failed.",
        retryable: false,
        stage: "writing_outputs",
        cause,
      });
    }
  }

  const outputManifest = {
    contractVersion: releaseJobExecutionContractVersion,
    kind: "release_artifact_site",
    generationId,
    siteRootKey,
    contentHash,
    extractedSizeBytes: manifest.extractedSizeBytes,
    fileCount: manifest.fileCount,
    entryPath: manifest.entryPath,
  };
  await reportProgress(
    {
      contractVersion: releaseJobExecutionContractVersion,
      stage: "committing",
      message: "Committing the generation and enqueueing browser validation.",
      completedUnits: manifest.fileCount,
      totalUnits: manifest.fileCount,
    },
    { outputRootKey: siteRootKey, outputManifest },
  );
  const committed = await commitReleaseArtifactJobAttempt({
    database,
    jobId,
    releaseId,
    generationId,
    leaseToken,
    workerId,
    siteRootKey,
    contentHash,
    manifest,
  });

  return committed;
};
