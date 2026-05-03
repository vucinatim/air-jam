import { db } from "@/db";
import { gameMediaAssets } from "@/db/schema";
import type {
  GameMediaKind,
  GameMediaStatus,
} from "@/lib/games/game-media-contract";
import {
  assertOwnedGameBySlugOrIdForMachine,
  serializeOwnedGameForMachine,
} from "@/server/games/machine-game";
import { buildManagedGameMediaUrl } from "@/server/media/game-media-public-url";
import {
  archiveGameMediaAsset,
  assignGameMediaAsset,
  finalizeGameMediaUpload,
  requestGameMediaUploadTarget,
} from "@/server/media/game-media-service";
import type {
  PlatformMachineOwnedGameMediaActive,
  PlatformMachineOwnedGameMediaAsset,
} from "@air-jam/sdk/platform-machine";
import { desc, eq } from "drizzle-orm";
import { PlatformMachineAuthError } from "../auth/machine-auth-errors";

const toMachineNotFoundError = (message: string) =>
  new PlatformMachineAuthError({
    code: "not_found",
    message,
    status: 404,
  });

const getActiveAssetIdByKind = ({
  game,
  kind,
}: {
  game: {
    thumbnailMediaAssetId: string | null;
    coverMediaAssetId: string | null;
    previewVideoMediaAssetId: string | null;
  };
  kind: GameMediaKind;
}): string | null => {
  switch (kind) {
    case "thumbnail":
      return game.thumbnailMediaAssetId;
    case "cover":
      return game.coverMediaAssetId;
    case "preview_video":
      return game.previewVideoMediaAssetId;
  }
};

const serializeGameMediaActive = ({
  thumbnailMediaAssetId,
  coverMediaAssetId,
  previewVideoMediaAssetId,
}: {
  thumbnailMediaAssetId: string | null;
  coverMediaAssetId: string | null;
  previewVideoMediaAssetId: string | null;
}): PlatformMachineOwnedGameMediaActive => ({
  thumbnailMediaAssetId,
  coverMediaAssetId,
  previewVideoMediaAssetId,
});

const serializeGameMediaAsset = ({
  asset,
  game,
}: {
  asset: typeof gameMediaAssets.$inferSelect;
  game: {
    id: string;
    thumbnailMediaAssetId: string | null;
    coverMediaAssetId: string | null;
    previewVideoMediaAssetId: string | null;
  };
}): PlatformMachineOwnedGameMediaAsset => {
  const activeAssetId = getActiveAssetIdByKind({
    game,
    kind: asset.kind,
  });

  return {
    id: asset.id,
    gameId: asset.gameId,
    kind: asset.kind,
    status: asset.status as GameMediaStatus,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    checksum: asset.checksum ?? null,
    width: asset.width ?? null,
    height: asset.height ?? null,
    durationSeconds: asset.durationSeconds ?? null,
    createdAt: asset.createdAt.toISOString(),
    updatedAt: asset.updatedAt.toISOString(),
    activeAssetId,
    isActive: activeAssetId === asset.id,
    publicUrl: buildManagedGameMediaUrl({
      gameId: asset.gameId,
      assetId: asset.status === "ready" ? asset.id : null,
      kind: asset.kind,
    }),
  };
};

export const inspectOwnedGameMediaForMachine = async ({
  slugOrId,
  userId,
}: {
  slugOrId: string;
  userId: string;
}) => {
  const game = await assertOwnedGameBySlugOrIdForMachine({ slugOrId, userId });
  const assets = await db.query.gameMediaAssets.findMany({
    where: (table, { eq }) => eq(table.gameId, game.id),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return {
    game: serializeOwnedGameForMachine(game),
    active: serializeGameMediaActive(game),
    assets: assets.map((asset) => serializeGameMediaAsset({ asset, game })),
  };
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
  const game = await assertOwnedGameBySlugOrIdForMachine({ slugOrId, userId });
  const { asset, upload } = await requestGameMediaUploadTarget({
    gameId: game.id,
    kind,
    originalFilename,
    contentType,
    sizeBytes,
  });

  return {
    game: serializeOwnedGameForMachine(game),
    asset: serializeGameMediaAsset({ asset, game }),
    upload,
  };
};

const getOwnedGameMediaAssetForMachine = async ({
  slugOrId,
  userId,
  assetId,
}: {
  slugOrId: string;
  userId: string;
  assetId: string;
}) => {
  const game = await assertOwnedGameBySlugOrIdForMachine({ slugOrId, userId });
  const asset = await db.query.gameMediaAssets.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, assetId), eq(table.gameId, game.id)),
  });

  if (!asset) {
    throw toMachineNotFoundError(`No owned media asset matched "${assetId}".`);
  }

  return {
    game,
    asset,
  };
};

const serializeMutatedOwnedGameMediaResult = async ({
  slugOrId,
  userId,
  assetId,
}: {
  slugOrId: string;
  userId: string;
  assetId: string;
}) => {
  const { game, asset } = await getOwnedGameMediaAssetForMachine({
    slugOrId,
    userId,
    assetId,
  });

  return {
    game: serializeOwnedGameForMachine(game),
    active: serializeGameMediaActive(game),
    asset: serializeGameMediaAsset({ asset, game }),
  };
};

export const finalizeOwnedGameMediaUploadForMachine = async ({
  slugOrId,
  userId,
  assetId,
}: {
  slugOrId: string;
  userId: string;
  assetId: string;
}) => {
  const game = await assertOwnedGameBySlugOrIdForMachine({ slugOrId, userId });
  await finalizeGameMediaUpload({
    gameId: game.id,
    assetId,
  });

  return serializeMutatedOwnedGameMediaResult({
    slugOrId,
    userId,
    assetId,
  });
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
  const game = await assertOwnedGameBySlugOrIdForMachine({ slugOrId, userId });
  await assignGameMediaAsset({
    gameId: game.id,
    assetId,
  });

  return serializeMutatedOwnedGameMediaResult({
    slugOrId,
    userId,
    assetId,
  });
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
  const game = await assertOwnedGameBySlugOrIdForMachine({ slugOrId, userId });
  await archiveGameMediaAsset({
    gameId: game.id,
    assetId,
  });

  return serializeMutatedOwnedGameMediaResult({
    slugOrId,
    userId,
    assetId,
  });
};
