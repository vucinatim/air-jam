import { db } from "@/db";
import { gameReleases, games } from "@/db/schema";
import { parseGameConfigLenient } from "@/lib/games/game-config-contract";
import { buildHostedReleaseAssetUrl } from "@/server/releases/release-public-url";
import type {
  PlatformMachineOwnedGameSummary,
  PlatformMachineReleaseSummary,
} from "@air-jam/sdk/platform-machine";
import { desc, eq } from "drizzle-orm";
import { PlatformMachineAuthError } from "../auth/machine-auth-errors";
import { assertOwnedGameBySlugOrId } from "../games/assert-owned-game-by-slug-or-id";
import { assertOwnedRelease } from "./assert-owned-release";
import { getReleaseDetails } from "./get-release-details";
import {
  finalizeReleaseUpload,
  requestReleaseUploadTarget,
} from "./release-artifact-service";
import { publishRelease } from "./release-status-service";

const toMachineOwnedGameSummary = (game: typeof games.$inferSelect) => {
  const config = parseGameConfigLenient(game.config);

  return {
    id: game.id,
    slug: game.slug ?? null,
    name: game.name,
    sourceUrl: config.sourceUrl ?? null,
    templateId: config.templateId ?? null,
    createdAt: game.createdAt.toISOString(),
    updatedAt: game.updatedAt.toISOString(),
  } satisfies PlatformMachineOwnedGameSummary;
};

export const serializeOwnedGameForMachine = toMachineOwnedGameSummary;

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
    game: toMachineOwnedGameSummary(release.game),
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

export const listOwnedGamesForMachine = async (userId: string) => {
  const ownedGames = await db
    .select()
    .from(games)
    .where(eq(games.userId, userId))
    .orderBy(desc(games.updatedAt));

  return ownedGames.map(toMachineOwnedGameSummary);
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

export const assertOwnedGameBySlugOrIdForMachine = async ({
  slugOrId,
  userId,
}: {
  slugOrId: string;
  userId: string;
}) => {
  try {
    return await assertOwnedGameBySlugOrId(slugOrId, userId);
  } catch {
    throw toMachineNotFoundError(`No owned game matched "${slugOrId.trim()}".`);
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
    return await assertOwnedRelease(releaseId, userId);
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
  const game = await assertOwnedGameBySlugOrIdForMachine({ slugOrId, userId });
  const releases = await db.query.gameReleases.findMany({
    where: (table, { eq }) => eq(table.gameId, game.id),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  const releaseDetails = await Promise.all(
    releases.map((release) => getReleaseDetails(release.id)),
  );

  return {
    game: toMachineOwnedGameSummary(game),
    releases: releaseDetails
      .filter(
        (
          detail,
        ): detail is NonNullable<
          Awaited<ReturnType<typeof getReleaseDetails>>
        > => detail !== null,
      )
      .map(serializeReleaseForMachine),
  };
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
  const game = await assertOwnedGameBySlugOrIdForMachine({ slugOrId, userId });

  const [release] = await db
    .insert(gameReleases)
    .values({
      id: crypto.randomUUID(),
      gameId: game.id,
      sourceKind: "upload",
      status: "draft",
      versionLabel: versionLabel?.trim() || null,
    })
    .returning();

  const releaseDetail = await getReleaseDetails(release.id);
  if (!releaseDetail) {
    throw toMachineConflictError("Draft release could not be reloaded.");
  }

  return serializeReleaseForMachine(releaseDetail);
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
  const release = await assertOwnedReleaseForMachine({ releaseId, userId });

  try {
    const result = await requestReleaseUploadTarget({
      release,
      originalFilename,
      sizeBytes,
    });

    const updatedRelease = await assertOwnedReleaseForMachine({
      releaseId: result.release.id,
      userId,
    });

    return {
      release: serializeReleaseForMachine(updatedRelease),
      upload: result.upload,
    };
  } catch (error) {
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
  const release = await assertOwnedReleaseForMachine({ releaseId, userId });

  try {
    await finalizeReleaseUpload({ release });
  } catch (error) {
    throw toMachineConflictError(
      error instanceof Error
        ? error.message
        : "Release upload could not be finalized.",
    );
  }

  const updatedRelease = await assertOwnedReleaseForMachine({
    releaseId,
    userId,
  });
  return serializeReleaseForMachine(updatedRelease);
};

export const publishReleaseForMachine = async ({
  releaseId,
  userId,
}: {
  releaseId: string;
  userId: string;
}) => {
  const release = await assertOwnedReleaseForMachine({ releaseId, userId });

  if (release.status !== "ready") {
    throw toMachineConflictError("Only ready releases can be published.");
  }

  try {
    await publishRelease({ releaseId });
  } catch (error) {
    throw toMachineConflictError(
      error instanceof Error
        ? error.message
        : "Release could not be published.",
    );
  }

  const updatedRelease = await assertOwnedReleaseForMachine({
    releaseId,
    userId,
  });
  return serializeReleaseForMachine(updatedRelease);
};
