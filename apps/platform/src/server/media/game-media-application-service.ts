import { db } from "@/db";
import type { GameMediaKind } from "@/lib/games/game-media-contract";
import { PlatformApplicationError } from "@/server/application-error";
import type { AuthenticatedPlatformActor } from "@/server/auth/application-actor";
import {
  resolveOwnedGame,
  type OwnedGameReference,
} from "@/server/games/owned-game-access";
import { assertOperationalLaneAccepting } from "@/server/operations/production-control-service";
import { loadGameMediaActive } from "./game-media-assignments";
import {
  archiveGameMediaAsset,
  assignGameMediaAsset,
  finalizeGameMediaUpload,
  inspectGameMedia,
  requestGameMediaUploadTarget,
} from "./game-media-service";

const loadOwnedMediaAsset = async ({
  gameId,
  assetId,
}: {
  gameId: string;
  assetId: string;
}) => {
  const asset = await db.query.gameMediaAssets.findFirst({
    where: (table, { and, eq }) =>
      and(eq(table.id, assetId), eq(table.gameId, gameId)),
  });

  if (!asset) {
    throw new PlatformApplicationError({
      code: "not_found",
      message: "Media asset not found or unauthorized.",
    });
  }

  return asset;
};

const loadMediaMutationResult = async ({
  game,
  assetId,
}: {
  game: Awaited<ReturnType<typeof resolveOwnedGame>>;
  assetId: string;
}) => {
  const [asset, active] = await Promise.all([
    loadOwnedMediaAsset({ gameId: game.id, assetId }),
    loadGameMediaActive({ gameId: game.id }),
  ]);

  return { game, active, asset };
};

export const inspectOwnedGameMedia = async ({
  actor,
  gameReference,
}: {
  actor: AuthenticatedPlatformActor;
  gameReference: OwnedGameReference;
}) => {
  const game = await resolveOwnedGame({ actor, reference: gameReference });
  const inspection = await inspectGameMedia({ gameId: game.id });
  return { game, ...inspection };
};

export const requestOwnedGameMediaUploadTarget = async ({
  actor,
  gameReference,
  kind,
  originalFilename,
  contentType,
  sizeBytes,
}: {
  actor: AuthenticatedPlatformActor;
  gameReference: OwnedGameReference;
  kind: GameMediaKind;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
}) => {
  const game = await resolveOwnedGame({ actor, reference: gameReference });
  await assertOperationalLaneAccepting({ lane: "media_ingestion" });
  const { asset, upload } = await requestGameMediaUploadTarget({
    gameId: game.id,
    kind,
    originalFilename,
    contentType,
    sizeBytes,
  });
  const active = await loadGameMediaActive({ gameId: game.id });

  return { game, active, asset, upload };
};

export const finalizeOwnedGameMediaUpload = async ({
  actor,
  gameReference,
  assetId,
}: {
  actor: AuthenticatedPlatformActor;
  gameReference: OwnedGameReference;
  assetId: string;
}) => {
  const game = await resolveOwnedGame({ actor, reference: gameReference });
  await loadOwnedMediaAsset({ gameId: game.id, assetId });
  await finalizeGameMediaUpload({ gameId: game.id, assetId });
  return loadMediaMutationResult({ game, assetId });
};

export const assignOwnedGameMediaAsset = async ({
  actor,
  gameReference,
  assetId,
}: {
  actor: AuthenticatedPlatformActor;
  gameReference: OwnedGameReference;
  assetId: string;
}) => {
  const game = await resolveOwnedGame({ actor, reference: gameReference });
  await loadOwnedMediaAsset({ gameId: game.id, assetId });
  await assignGameMediaAsset({ gameId: game.id, assetId });
  return loadMediaMutationResult({ game, assetId });
};

export const archiveOwnedGameMediaAsset = async ({
  actor,
  gameReference,
  assetId,
}: {
  actor: AuthenticatedPlatformActor;
  gameReference: OwnedGameReference;
  assetId: string;
}) => {
  const game = await resolveOwnedGame({ actor, reference: gameReference });
  await loadOwnedMediaAsset({ gameId: game.id, assetId });
  await archiveGameMediaAsset({ gameId: game.id, assetId });
  return loadMediaMutationResult({ game, assetId });
};
