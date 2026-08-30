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
import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import type { assertOwnedRelease } from "./assert-owned-release";
import {
  readReleaseArchiveManifest,
  streamValidatedReleaseArchiveFiles,
} from "./release-artifact-validation";
import type { ReleaseModerationSummary } from "./release-moderation-service";
import { runReleaseModeration } from "./release-moderation-service";
import { getReleaseStorage, type ReleaseStorage } from "./release-storage";
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
  database?: typeof db;
  storage?: ReleaseStorage;
};

type FinalizeReleaseUploadInput = {
  release: OwnedRelease;
  generationId: string;
  database?: typeof db;
  storage?: ReleaseStorage;
  moderate?: typeof runReleaseModeration;
};

const ARTIFACT_VALIDATION_CHECK_KIND = "artifact_validation";
const RELEASE_UPLOAD_VISIBILITY_ATTEMPTS = 8;
const RELEASE_UPLOAD_VISIBILITY_DELAY_MS = 250;

class ReleaseUploadFactsValidationError extends Error {
  override readonly name = "ReleaseUploadFactsValidationError";
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

const markGenerationFailure = async ({
  database,
  releaseId,
  generationId,
  message,
  payload,
}: {
  database: typeof db;
  releaseId: string;
  generationId: string;
  message: string;
  payload: Record<string, unknown>;
}) =>
  database.transaction(async (tx) => {
    await lockRelease(tx, releaseId);
    await lockGeneration(tx, generationId);

    const release = await tx.query.gameReleases.findFirst({
      where: (table, { eq }) => eq(table.id, releaseId),
    });
    const generation = await tx.query.gameReleaseGenerations.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, generationId), eq(table.releaseId, releaseId)),
    });

    if (
      !release ||
      !generation ||
      release.candidateGenerationId !== generationId ||
      !["awaiting_upload", "processing"].includes(generation.status)
    ) {
      return false;
    }

    await tx
      .update(gameReleaseGenerations)
      .set({
        status: "failed",
        failedAt: sql`clock_timestamp()`,
      })
      .where(eq(gameReleaseGenerations.id, generationId));

    await tx
      .update(gameReleases)
      .set({
        status: "failed",
        candidateGenerationId: null,
        checkedAt: sql`clock_timestamp()`,
      })
      .where(eq(gameReleases.id, releaseId));

    await tx.insert(gameReleaseChecks).values({
      id: crypto.randomUUID(),
      releaseId,
      generationId,
      kind: ARTIFACT_VALIDATION_CHECK_KIND,
      status: "failed",
      summary: message,
      payload,
    });

    return true;
  });

const markModerationFailure = async ({
  database,
  releaseId,
  generationId,
}: {
  database: typeof db;
  releaseId: string;
  generationId: string;
}) =>
  database.transaction(async (tx) => {
    await lockRelease(tx, releaseId);
    const release = await tx.query.gameReleases.findFirst({
      where: (table, { eq }) => eq(table.id, releaseId),
    });

    if (
      !release ||
      release.status !== "checking" ||
      release.candidateGenerationId !== generationId ||
      release.promotedGenerationId !== generationId
    ) {
      return false;
    }

    await tx
      .update(gameReleases)
      .set({
        status: "failed",
        candidateGenerationId: null,
        checkedAt: sql`clock_timestamp()`,
      })
      .where(eq(gameReleases.id, releaseId));
    return true;
  });

export const resolveReleasePostModerationAction = (
  moderation: Pick<ReleaseModerationSummary, "outcome" | "reason">,
) => {
  switch (moderation.outcome) {
    case "passed":
    case "disabled":
      return { kind: "ready" } as const;
    case "flagged":
      return { kind: "quarantined" } as const;
    case "skipped":
      return {
        kind: "failed",
        message:
          moderation.reason ??
          "Release moderation is required before a hosted release can become ready.",
      } as const;
  }
};

export const requestReleaseUploadTarget = async ({
  release,
  originalFilename,
  sizeBytes,
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

const claimGenerationForProcessing = async ({
  database,
  releaseId,
  generationId,
  uploadedObject,
}: {
  database: typeof db;
  releaseId: string;
  generationId: string;
  uploadedObject: NonNullable<
    Awaited<ReturnType<ReturnType<typeof getReleaseStorage>["headObject"]>>
  >;
}) =>
  database.transaction(async (tx) => {
    await lockRelease(tx, releaseId);
    await lockGeneration(tx, generationId);
    const release = await tx.query.gameReleases.findFirst({
      where: (table, { eq }) => eq(table.id, releaseId),
    });
    const generation = await tx.query.gameReleaseGenerations.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, generationId), eq(table.releaseId, releaseId)),
    });

    if (
      !release ||
      !generation ||
      release.status !== "uploading" ||
      release.candidateGenerationId !== generationId ||
      generation.status !== "awaiting_upload"
    ) {
      throw new Error(
        "Release generation is no longer eligible for processing.",
      );
    }

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

const promoteValidatedGeneration = async ({
  database,
  releaseId,
  generationId,
  siteRootKey,
  contentHash,
  manifest,
}: {
  database: typeof db;
  releaseId: string;
  generationId: string;
  siteRootKey: string;
  contentHash: string;
  manifest: Awaited<ReturnType<typeof readReleaseArchiveManifest>>;
}) =>
  database.transaction(async (tx) => {
    await lockRelease(tx, releaseId);
    await lockGeneration(tx, generationId);
    const release = await tx.query.gameReleases.findFirst({
      where: (table, { eq }) => eq(table.id, releaseId),
    });
    const generation = await tx.query.gameReleaseGenerations.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.id, generationId), eq(table.releaseId, releaseId)),
    });

    if (
      !release ||
      !generation ||
      release.status !== "checking" ||
      release.candidateGenerationId !== generationId ||
      generation.status !== "processing"
    ) {
      throw new Error("Release generation lost promotion authority.");
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

    if (!readyGeneration || !promotedRelease) {
      throw new Error("Release generation changed during promotion.");
    }

    await tx.insert(gameReleaseChecks).values({
      id: crypto.randomUUID(),
      releaseId,
      generationId,
      kind: ARTIFACT_VALIDATION_CHECK_KIND,
      status: "passed",
      summary: `Validated ${manifest.fileCount} files and extracted ${manifest.extractedSizeBytes} bytes.`,
      payload: {
        zipObjectKey: generation.zipObjectKey,
        siteRootKey,
        fileCount: manifest.fileCount,
        extractedSizeBytes: manifest.extractedSizeBytes,
        entryPath: manifest.entryPath,
        hostedManifest: manifest.hostedManifest,
        contentHash,
      },
    });

    return readyGeneration;
  });

const completeModeration = async ({
  database,
  releaseId,
  generationId,
  action,
}: {
  database: typeof db;
  releaseId: string;
  generationId: string;
  action: "ready" | "quarantined";
}) =>
  database.transaction(async (tx) => {
    await lockRelease(tx, releaseId);
    const release = await tx.query.gameReleases.findFirst({
      where: (table, { eq }) => eq(table.id, releaseId),
    });

    if (
      !release ||
      release.status !== "checking" ||
      release.candidateGenerationId !== generationId ||
      release.promotedGenerationId !== generationId
    ) {
      throw new Error("Release generation lost moderation authority.");
    }

    const [updatedRelease] = await tx
      .update(gameReleases)
      .set({
        status: action,
        candidateGenerationId: null,
        checkedAt: sql`clock_timestamp()`,
        quarantinedAt: action === "quarantined" ? sql`clock_timestamp()` : null,
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
      throw new Error(
        "Release generation changed during moderation completion.",
      );
    }
    return updatedRelease;
  });

export const finalizeReleaseUpload = async ({
  release,
  generationId,
  database = db,
  storage = getReleaseStorage(),
  moderate = runReleaseModeration,
}: FinalizeReleaseUploadInput) => {
  const generation = await database.query.gameReleaseGenerations.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, generationId), eq(table.releaseId, release.id)),
  });
  if (!generation) {
    throw new Error("Release generation not found.");
  }

  const uploadedObject = await waitForUploadedArtifact({
    storage,
    zipObjectKey: generation.zipObjectKey,
  });
  if (!uploadedObject) {
    await markGenerationFailure({
      database,
      releaseId: release.id,
      generationId,
      message: "Uploaded artifact was not found in release storage.",
      payload: {
        reason: "missing_upload",
        zipObjectKey: generation.zipObjectKey,
        attempts: RELEASE_UPLOAD_VISIBILITY_ATTEMPTS,
        retryDelayMs: RELEASE_UPLOAD_VISIBILITY_DELAY_MS,
      },
    });
    throw new Error("Uploaded artifact was not found in release storage.");
  }

  if (
    uploadedObject.sizeBytes <= 0 ||
    uploadedObject.sizeBytes > MAX_RELEASE_ZIP_BYTES
  ) {
    const message = `Uploaded archive exceeds the ${MAX_RELEASE_ZIP_BYTES} byte limit.`;
    await markGenerationFailure({
      database,
      releaseId: release.id,
      generationId,
      message,
      payload: {
        reason: "zip_size_limit_exceeded",
        sizeBytes: uploadedObject.sizeBytes,
        zipObjectKey: generation.zipObjectKey,
      },
    });
    throw new Error(message);
  }

  let processingGeneration;
  try {
    processingGeneration = await claimGenerationForProcessing({
      database,
      releaseId: release.id,
      generationId,
      uploadedObject,
    });
  } catch (error) {
    if (error instanceof ReleaseUploadFactsValidationError) {
      await markGenerationFailure({
        database,
        releaseId: release.id,
        generationId,
        message: error.message,
        payload: { reason: "upload_facts_invalid" },
      });
    }
    throw error;
  }

  const siteRootKey = buildReleaseGenerationSiteRootKey({
    gameId: release.gameId,
    releaseId: release.id,
    generationId,
    outputId: crypto.randomUUID(),
  });

  let promoted = false;
  try {
    if (!processingGeneration.observedEtag) {
      throw new Error("Processing generation is missing its observed ETag.");
    }
    const archiveBuffer = await storage.readObject(
      processingGeneration.zipObjectKey,
      { expectedEtag: processingGeneration.observedEtag },
    );
    const contentHash = createHash("sha256")
      .update(archiveBuffer)
      .digest("hex");
    const manifest = await readReleaseArchiveManifest(archiveBuffer);

    await streamValidatedReleaseArchiveFiles({
      archiveBuffer,
      files: manifest.files,
      onFile: async (file, stream) => {
        const body = await readStreamToBuffer(stream, file.sizeBytes);
        await storage.putObject({
          key: buildReleaseSiteObjectKey(siteRootKey, file.relativePath),
          body,
          contentType: file.contentType,
          cacheControl: file.cacheControl,
          writeMode: "create",
        });
      },
    });

    const readyGeneration = await promoteValidatedGeneration({
      database,
      releaseId: release.id,
      generationId,
      siteRootKey,
      contentHash,
      manifest,
    });
    promoted = true;

    const moderation = await moderate({
      releaseId: release.id,
      generationId,
    });
    const postModerationAction = resolveReleasePostModerationAction(moderation);

    if (postModerationAction.kind === "ready") {
      await completeModeration({
        database,
        releaseId: release.id,
        generationId,
        action: "ready",
      });
      return readyGeneration;
    }

    if (postModerationAction.kind === "quarantined") {
      await completeModeration({
        database,
        releaseId: release.id,
        generationId,
        action: "quarantined",
      });
      return readyGeneration;
    }

    throw new Error(postModerationAction.message);
  } catch (error) {
    if (promoted) {
      await markModerationFailure({
        database,
        releaseId: release.id,
        generationId,
      });
    } else {
      await markGenerationFailure({
        database,
        releaseId: release.id,
        generationId,
        message:
          error instanceof Error
            ? error.message
            : "Release artifact validation failed.",
        payload: {
          reason: "artifact_validation_failed",
          zipObjectKey: processingGeneration.zipObjectKey,
        },
      });
    }
    throw error;
  }
};
