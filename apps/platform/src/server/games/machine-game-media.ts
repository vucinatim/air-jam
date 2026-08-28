import { gameMediaAssets } from "@/db/schema";
import type {
  GameMediaKind,
  GameMediaStatus,
} from "@/lib/games/game-media-contract";
import { PlatformApplicationError } from "@/server/application-error";
import { serializeOwnedGameForMachine } from "@/server/games/machine-game";
import {
  archiveOwnedGameMediaAsset,
  assignOwnedGameMediaAsset,
  finalizeOwnedGameMediaUpload,
  inspectOwnedGameMedia,
  requestOwnedGameMediaUploadTarget,
} from "@/server/media/game-media-application-service";
import { type GameMediaActiveProjection } from "@/server/media/game-media-assignments";
import { projectGameMediaAsset } from "@/server/media/game-media-projection";
import type { PlatformMachineOwnedGameMediaAsset } from "@air-jam/sdk/platform-machine";
import { PlatformMachineAuthError } from "../auth/machine-auth-errors";

const toMachineNotFoundError = (message: string) =>
  new PlatformMachineAuthError({
    code: "not_found",
    message,
    status: 404,
  });

const serializeGameMediaAsset = ({
  asset,
  active,
}: {
  asset: typeof gameMediaAssets.$inferSelect;
  active: GameMediaActiveProjection;
}): PlatformMachineOwnedGameMediaAsset => {
  const projectedAsset = projectGameMediaAsset({ asset, active });

  return {
    id: projectedAsset.id,
    gameId: projectedAsset.gameId,
    kind: projectedAsset.kind,
    status: projectedAsset.status as GameMediaStatus,
    originalFilename: projectedAsset.originalFilename,
    mimeType: projectedAsset.mimeType,
    sizeBytes: projectedAsset.sizeBytes,
    checksum: projectedAsset.checksum ?? null,
    width: projectedAsset.width ?? null,
    height: projectedAsset.height ?? null,
    durationSeconds: projectedAsset.durationSeconds ?? null,
    createdAt: projectedAsset.createdAt.toISOString(),
    updatedAt: projectedAsset.updatedAt.toISOString(),
    activeAssetId: projectedAsset.activeAssetId,
    isActive: projectedAsset.isActive,
    publicUrl: projectedAsset.publicUrl,
  };
};

const rethrowMachineNotFound = (error: unknown, message: string): void => {
  if (error instanceof PlatformApplicationError && error.code === "not_found") {
    throw toMachineNotFoundError(message);
  }
};

export const inspectOwnedGameMediaForMachine = async ({
  slugOrId,
  userId,
}: {
  slugOrId: string;
  userId: string;
}) => {
  try {
    const { game, active, assets } = await inspectOwnedGameMedia({
      actor: { userId },
      gameReference: { kind: "slug-or-id", slugOrId },
    });
    return {
      game: serializeOwnedGameForMachine(game),
      active,
      assets: assets.map((asset) => serializeGameMediaAsset({ asset, active })),
    };
  } catch (error) {
    rethrowMachineNotFound(error, `No owned game matched "${slugOrId}".`);
    throw error;
  }
};

export const requestOwnedGameMediaUploadTargetForMachine = async ({
  slugOrId,
  userId,
  kind,
  originalFilename,
  contentType,
  sizeBytes,
}: {
  slugOrId: string;
  userId: string;
  kind: GameMediaKind;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
}) => {
  try {
    const { game, active, asset, upload } =
      await requestOwnedGameMediaUploadTarget({
        actor: { userId },
        gameReference: { kind: "slug-or-id", slugOrId },
        kind,
        originalFilename,
        contentType,
        sizeBytes,
      });
    return {
      game: serializeOwnedGameForMachine(game),
      asset: serializeGameMediaAsset({ asset, active }),
      upload,
    };
  } catch (error) {
    rethrowMachineNotFound(error, `No owned game matched "${slugOrId}".`);
    throw error;
  }
};

const serializeMutationResult = ({
  game,
  active,
  asset,
}: Awaited<ReturnType<typeof finalizeOwnedGameMediaUpload>>) => ({
  game: serializeOwnedGameForMachine(game),
  active,
  asset: serializeGameMediaAsset({ asset, active }),
});

export const finalizeOwnedGameMediaUploadForMachine = async ({
  slugOrId,
  userId,
  assetId,
}: {
  slugOrId: string;
  userId: string;
  assetId: string;
}) => {
  try {
    return serializeMutationResult(
      await finalizeOwnedGameMediaUpload({
        actor: { userId },
        gameReference: { kind: "slug-or-id", slugOrId },
        assetId,
      }),
    );
  } catch (error) {
    rethrowMachineNotFound(error, `No owned media asset matched "${assetId}".`);
    throw error;
  }
};

export const assignOwnedGameMediaAssetForMachine = async ({
  slugOrId,
  userId,
  assetId,
}: {
  slugOrId: string;
  userId: string;
  assetId: string;
}) => {
  try {
    return serializeMutationResult(
      await assignOwnedGameMediaAsset({
        actor: { userId },
        gameReference: { kind: "slug-or-id", slugOrId },
        assetId,
      }),
    );
  } catch (error) {
    rethrowMachineNotFound(error, `No owned media asset matched "${assetId}".`);
    throw error;
  }
};

export const archiveOwnedGameMediaAssetForMachine = async ({
  slugOrId,
  userId,
  assetId,
}: {
  slugOrId: string;
  userId: string;
  assetId: string;
}) => {
  try {
    return serializeMutationResult(
      await archiveOwnedGameMediaAsset({
        actor: { userId },
        gameReference: { kind: "slug-or-id", slugOrId },
        assetId,
      }),
    );
  } catch (error) {
    rethrowMachineNotFound(error, `No owned media asset matched "${assetId}".`);
    throw error;
  }
};
