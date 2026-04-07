import { db } from "@/db";
import {
  gameReleaseArtifacts,
  gameReleaseChecks,
  gameReleases,
} from "@/db/schema";
import {
  MAX_RELEASE_ZIP_BYTES,
  RELEASE_UPLOAD_CONTENT_TYPE,
  RELEASE_UPLOAD_FILENAME_EXTENSION,
} from "@/lib/releases/release-policy";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import type { assertOwnedRelease } from "./assert-owned-release";
import {
  readReleaseArchiveManifest,
  streamValidatedReleaseArchiveFiles,
} from "./release-artifact-validation";
import type { ReleaseModerationSummary } from "./release-moderation-service";
import {
  buildReleaseSiteObjectKey,
  buildReleaseStorageKeys,
} from "./release-storage-keys";
import { runReleaseModeration } from "./release-moderation-service";
import { getReleaseStorage } from "./release-storage";

type OwnedRelease = Awaited<ReturnType<typeof assertOwnedRelease>>;

type RequestReleaseUploadTargetInput = {
  release: OwnedRelease;
  originalFilename: string;
  sizeBytes: number;
};

type FinalizeReleaseUploadInput = {
  release: OwnedRelease;
};

const ARTIFACT_VALIDATION_CHECK_KIND = "artifact_validation";
const RELEASE_UPLOAD_VISIBILITY_ATTEMPTS = 8;
const RELEASE_UPLOAD_VISIBILITY_DELAY_MS = 250;

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
    !trimmedFilename
      .toLowerCase()
      .endsWith(RELEASE_UPLOAD_FILENAME_EXTENSION)
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
  storage: ReturnType<typeof getReleaseStorage>;
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

const setReleaseFailedStatus = async ({
  releaseId,
  uploadedAt,
  checkedAt = new Date(),
}: {
  releaseId: string;
  uploadedAt: Date | null;
  checkedAt?: Date;
}) => {
  await db
    .update(gameReleases)
    .set({
      status: "failed",
      uploadedAt: uploadedAt ?? undefined,
      checkedAt,
    })
    .where(eq(gameReleases.id, releaseId));
};

export const resolveReleasePostModerationAction = (
  moderation: Pick<ReleaseModerationSummary, "outcome" | "reason">,
) => {
  switch (moderation.outcome) {
    case "passed":
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

const markReleaseUploadFailure = async ({
  releaseId,
  uploadedAt,
  message,
  payload,
}: {
  releaseId: string;
  uploadedAt: Date | null;
  message: string;
  payload: Record<string, unknown>;
}) => {
  const checkedAt = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(gameReleases)
      .set({
        status: "failed",
        uploadedAt: uploadedAt ?? undefined,
        checkedAt,
      })
      .where(eq(gameReleases.id, releaseId));

    await tx.insert(gameReleaseChecks).values({
      id: crypto.randomUUID(),
      releaseId,
      kind: ARTIFACT_VALIDATION_CHECK_KIND,
      status: "failed",
      summary: message,
      payload,
    });
  });
};

export const requestReleaseUploadTarget = async ({
  release,
  originalFilename,
  sizeBytes,
}: RequestReleaseUploadTargetInput) => {
  if (!["draft", "uploading", "failed"].includes(release.status)) {
    throw new Error(
      "Only draft or failed releases can request a new artifact upload.",
    );
  }

  if (sizeBytes <= 0 || sizeBytes > MAX_RELEASE_ZIP_BYTES) {
    throw new Error(
      `Release archives must be between 1 byte and ${MAX_RELEASE_ZIP_BYTES} bytes.`,
    );
  }

  const validatedFilename = assertValidReleaseUploadFilename(originalFilename);
  const storage = getReleaseStorage();
  const { zipObjectKey } = buildReleaseStorageKeys({
    gameId: release.gameId,
    releaseId: release.id,
  });

  const upload = await storage.createArtifactUploadTarget({
    key: zipObjectKey,
    contentType: RELEASE_UPLOAD_CONTENT_TYPE,
    originalFilename: validatedFilename,
  });

  const [updatedRelease] = await db
    .update(gameReleases)
    .set({
      status: "uploading",
      uploadedAt: null,
      checkedAt: null,
    })
    .where(eq(gameReleases.id, release.id))
    .returning();

  return {
    release: updatedRelease,
    upload,
  };
};

export const finalizeReleaseUpload = async ({
  release,
}: FinalizeReleaseUploadInput) => {
  if (release.status !== "uploading") {
    throw new Error("Only uploading releases can be finalized.");
  }

  const storage = getReleaseStorage();
  const { siteRootKey, zipObjectKey } = buildReleaseStorageKeys({
    gameId: release.gameId,
    releaseId: release.id,
  });

  const [checkingRelease] = await db
    .update(gameReleases)
    .set({
      status: "checking",
    })
    .where(
      and(
        eq(gameReleases.id, release.id),
        eq(gameReleases.status, "uploading"),
      ),
    )
    .returning();

  if (!checkingRelease) {
    throw new Error("Release changed while finalizing upload.");
  }

  const uploadedObject = await waitForUploadedArtifact({
    storage,
    zipObjectKey,
  });
  if (!uploadedObject) {
    await markReleaseUploadFailure({
      releaseId: release.id,
      uploadedAt: null,
      message: "Uploaded artifact was not found in release storage.",
      payload: {
        reason: "missing_upload",
        zipObjectKey,
        attempts: RELEASE_UPLOAD_VISIBILITY_ATTEMPTS,
        retryDelayMs: RELEASE_UPLOAD_VISIBILITY_DELAY_MS,
      },
    });
    throw new Error("Uploaded artifact was not found in release storage.");
  }

  const uploadedAt = new Date();

  if (uploadedObject.sizeBytes <= 0 || uploadedObject.sizeBytes > MAX_RELEASE_ZIP_BYTES) {
    const message = `Uploaded archive exceeds the ${MAX_RELEASE_ZIP_BYTES} byte limit.`;
    await markReleaseUploadFailure({
      releaseId: release.id,
      uploadedAt,
      message,
      payload: {
        reason: "zip_size_limit_exceeded",
        sizeBytes: uploadedObject.sizeBytes,
        zipObjectKey,
      },
    });
    throw new Error(message);
  }

  try {
    const archiveBuffer = await storage.readObject(zipObjectKey);
    const manifest = await readReleaseArchiveManifest(archiveBuffer);

    await storage.deletePrefix(`${siteRootKey}/`);

    try {
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
          });
        },
      });
    } catch (error) {
      await storage.deletePrefix(`${siteRootKey}/`);
      throw error;
    }

    const contentHash = createHash("sha256").update(archiveBuffer).digest("hex");
    const originalFilename =
      uploadedObject.metadata["original-filename"] ?? "artifact.zip";
    const summary = `Validated ${manifest.fileCount} files and extracted ${manifest.extractedSizeBytes} bytes.`;
    const checkedAt = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(gameReleases)
        .set({
          status: "checking",
          uploadedAt,
          checkedAt: null,
        })
        .where(eq(gameReleases.id, release.id));

      await tx
        .insert(gameReleaseArtifacts)
        .values({
          id: crypto.randomUUID(),
          releaseId: release.id,
          originalFilename,
          contentType:
            uploadedObject.contentType ?? RELEASE_UPLOAD_CONTENT_TYPE,
          sizeBytes: uploadedObject.sizeBytes,
          extractedSizeBytes: manifest.extractedSizeBytes,
          fileCount: manifest.fileCount,
          zipObjectKey,
          siteRootKey,
          entryPath: manifest.entryPath,
          contentHash,
        })
        .onConflictDoUpdate({
          target: gameReleaseArtifacts.releaseId,
          set: {
            originalFilename,
            contentType:
              uploadedObject.contentType ?? RELEASE_UPLOAD_CONTENT_TYPE,
            sizeBytes: uploadedObject.sizeBytes,
            extractedSizeBytes: manifest.extractedSizeBytes,
            fileCount: manifest.fileCount,
            zipObjectKey,
            siteRootKey,
            entryPath: manifest.entryPath,
            contentHash,
          },
        });

      await tx.insert(gameReleaseChecks).values({
        id: crypto.randomUUID(),
        releaseId: release.id,
        kind: ARTIFACT_VALIDATION_CHECK_KIND,
        status: "passed",
        summary,
        payload: {
          zipObjectKey,
          siteRootKey,
          fileCount: manifest.fileCount,
          extractedSizeBytes: manifest.extractedSizeBytes,
          entryPath: manifest.entryPath,
          hostedManifest: manifest.hostedManifest,
          contentHash,
        },
      });
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Release artifact validation failed.";

    await markReleaseUploadFailure({
      releaseId: release.id,
      uploadedAt,
      message,
      payload: {
        reason: "artifact_validation_failed",
        zipObjectKey,
      },
    });

    throw error;
  }

  try {
    const checkedAt = new Date();
    const moderation = await runReleaseModeration({
      releaseId: release.id,
    });
    const postModerationAction = resolveReleasePostModerationAction(moderation);

    if (postModerationAction.kind === "ready") {
      await db
        .update(gameReleases)
        .set({
          status: "ready",
          checkedAt,
          quarantinedAt: null,
        })
        .where(eq(gameReleases.id, release.id));
      return;
    }

    if (postModerationAction.kind === "quarantined") {
      return;
    }

    await setReleaseFailedStatus({
      releaseId: release.id,
      uploadedAt,
      checkedAt,
    });
    throw new Error(postModerationAction.message);
  } catch (error) {
    await setReleaseFailedStatus({
      releaseId: release.id,
      uploadedAt,
    });
    throw error;
  }
};
