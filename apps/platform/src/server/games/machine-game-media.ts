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
import {
  getActiveGameMediaAssetId,
  loadGameMediaActive,
  type GameMediaActiveProjection,
} from "@/server/media/game-media-assignments";
import { buildManagedGameMediaUrl } from "@/server/media/game-media-public-url";
import {
  archiveGameMediaAsset,
  assignGameMediaAsset,
  finalizeGameMediaUpload,
  inspectGameMedia,
  requestGameMediaUploadTarget,
} from "@/server/media/game-media-service";
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
  const activeAssetId = getActiveGameMediaAssetId(active, asset.kind);

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
  const { active, assets } = await inspectGameMedia({ gameId: game.id });

  return {
    game: serializeOwnedGameForMachine(game),
    active,
    assets: assets.map((asset) => serializeGameMediaAsset({ asset, active })),
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
  const active = await loadGameMediaActive({ gameId: game.id });

  return {
    game: serializeOwnedGameForMachine(game),
    asset: serializeGameMediaAsset({ asset, active }),
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
  const active = await loadGameMediaActive({ gameId: game.id });

  return {
    game: serializeOwnedGameForMachine(game),
    active,
    asset: serializeGameMediaAsset({ asset, active }),
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
