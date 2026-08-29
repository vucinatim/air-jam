import { PlatformApplicationError } from "@/server/application-error";
import { buildHostedReleaseAssetUrl } from "@/server/releases/release-public-url";
import type { PlatformMachineReleaseSummary } from "@air-jam/sdk/platform-machine";
import {
  PlatformMachineAuthError,
  rethrowOperationalAdmissionForMachine,
} from "../auth/machine-auth-errors";
import { serializeOwnedGameForMachine } from "../games/machine-game";
import { getReleaseDetails } from "./get-release-details";
import {
  createOwnedDraftRelease,
  finalizeOwnedReleaseUpload,
  getOwnedRelease,
  listOwnedGameReleases,
  publishOwnedRelease,
  requestOwnedReleaseUploadTarget,
} from "./release-application-service";

export const serializeReleaseForMachine = (
  release: NonNullable<Awaited<ReturnType<typeof getReleaseDetails>>>,
) => {
  const artifact = release.artifact;

  return {
    id: release.id,
    gameId: release.gameId,
    sourceKind: release.sourceKind,
    status: release.status,
    versionLabel: release.versionLabel,
    createdAt: release.createdAt.toISOString(),
    uploadedAt: release.uploadedAt?.toISOString() ?? null,
    checkedAt: release.checkedAt?.toISOString() ?? null,
    publishedAt: release.publishedAt?.toISOString() ?? null,
    quarantinedAt: release.quarantinedAt?.toISOString() ?? null,
    archivedAt: release.archivedAt?.toISOString() ?? null,
    game: serializeOwnedGameForMachine(release.game),
    artifact: artifact
      ? {
          id: artifact.id,
          releaseId: artifact.releaseId,
          originalFilename: artifact.originalFilename,
          contentType: artifact.contentType,
          sizeBytes: artifact.sizeBytes,
          extractedSizeBytes: artifact.extractedSizeBytes ?? null,
          fileCount: artifact.fileCount ?? null,
          entryPath: artifact.entryPath,
          contentHash: artifact.contentHash ?? null,
          createdAt: artifact.createdAt.toISOString(),
        }
      : null,
    checks: release.checks.map((check) => ({
      id: check.id,
      releaseId: check.releaseId,
      kind: check.kind,
      status: check.status,
      summary: check.summary ?? null,
      payload: check.payload ?? {},
      createdAt: check.createdAt.toISOString(),
    })),
    reports: release.reports.map((report) => ({
      id: report.id,
      releaseId: report.releaseId,
      status: report.status,
      source: report.source,
      reason: report.reason,
      details: report.details ?? null,
      reporterEmail: report.reporterEmail ?? null,
      createdAt: report.createdAt.toISOString(),
      reviewedAt: report.reviewedAt?.toISOString() ?? null,
    })),
    hostUrl: artifact
      ? buildHostedReleaseAssetUrl({
          gameId: release.gameId,
          releaseId: release.id,
          assetPath: "/",
        })
      : null,
    controllerUrl: artifact
      ? buildHostedReleaseAssetUrl({
          gameId: release.gameId,
          releaseId: release.id,
          assetPath: "/controller",
        })
      : null,
  } satisfies PlatformMachineReleaseSummary;
};

const toMachineNotFoundError = (message: string) =>
  new PlatformMachineAuthError({
    code: "not_found",
    message,
    status: 404,
  });

const toMachineConflictError = (message: string) =>
  new PlatformMachineAuthError({
    code: "conflict",
    message,
    status: 409,
  });

const toMachineValidationError = (message: string) =>
  new PlatformMachineAuthError({
    code: "validation_failed",
    message,
    status: 400,
  });

const rethrowMachineNotFound = (error: unknown, message: string): void => {
  if (error instanceof PlatformApplicationError && error.code === "not_found") {
    throw toMachineNotFoundError(message);
  }
};

export const assertOwnedReleaseForMachine = async ({
  releaseId,
  userId,
}: {
  releaseId: string;
  userId: string;
}) => {
  try {
    return await getOwnedRelease({ actor: { userId }, releaseId });
  } catch {
    throw toMachineNotFoundError(`No owned release matched "${releaseId}".`);
  }
};

export const listOwnedReleasesForMachine = async ({
  slugOrId,
  userId,
}: {
  slugOrId: string;
  userId: string;
}) => {
  try {
    const { game, releases } = await listOwnedGameReleases({
      actor: { userId },
      gameReference: { kind: "slug-or-id", slugOrId },
    });

    return {
      game: serializeOwnedGameForMachine(game),
      releases: releases.map(serializeReleaseForMachine),
    };
  } catch (error) {
    rethrowMachineNotFound(error, `No owned game matched "${slugOrId}".`);
    throw error;
  }
};

export const createDraftReleaseForMachine = async ({
  slugOrId,
  userId,
  versionLabel,
}: {
  slugOrId: string;
  userId: string;
  versionLabel?: string;
}) => {
  try {
    const release = await createOwnedDraftRelease({
      actor: { userId },
      gameReference: { kind: "slug-or-id", slugOrId },
      versionLabel,
    });
    return serializeReleaseForMachine(release);
  } catch (error) {
    rethrowOperationalAdmissionForMachine(error);
    rethrowMachineNotFound(error, `No owned game matched "${slugOrId}".`);
    throw toMachineConflictError(
      error instanceof Error
        ? error.message
        : "Draft release could not be created.",
    );
  }
};

export const requestReleaseUploadTargetForMachine = async ({
  releaseId,
  userId,
  originalFilename,
  sizeBytes,
}: {
  releaseId: string;
  userId: string;
  originalFilename: string;
  sizeBytes: number;
}) => {
  try {
    const result = await requestOwnedReleaseUploadTarget({
      actor: { userId },
      releaseId,
      originalFilename,
      sizeBytes,
    });

    return {
      release: serializeReleaseForMachine(result.release),
      upload: result.upload,
    };
  } catch (error) {
    rethrowOperationalAdmissionForMachine(error);
    rethrowMachineNotFound(error, `No owned release matched "${releaseId}".`);
    throw toMachineValidationError(
      error instanceof Error
        ? error.message
        : "Invalid release upload request.",
    );
  }
};

export const finalizeReleaseUploadForMachine = async ({
  releaseId,
  userId,
}: {
  releaseId: string;
  userId: string;
}) => {
  try {
    const release = await finalizeOwnedReleaseUpload({
      actor: { userId },
      releaseId,
    });
    return serializeReleaseForMachine(release);
  } catch (error) {
    rethrowOperationalAdmissionForMachine(error);
    rethrowMachineNotFound(error, `No owned release matched "${releaseId}".`);
    throw toMachineConflictError(
      error instanceof Error
        ? error.message
        : "Release upload could not be finalized.",
    );
  }
};

export const publishReleaseForMachine = async ({
  releaseId,
  userId,
}: {
  releaseId: string;
  userId: string;
}) => {
  try {
    const release = await publishOwnedRelease({
      actor: { userId },
      releaseId,
    });
    return serializeReleaseForMachine(release);
  } catch (error) {
    rethrowMachineNotFound(error, `No owned release matched "${releaseId}".`);
    throw toMachineConflictError(
      error instanceof Error
        ? error.message
        : "Release could not be published.",
    );
  }
};
