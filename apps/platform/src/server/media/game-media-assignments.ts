import { db } from "@/db";
import { gameMediaAssignments } from "@/db/schema";
import type { GameMediaKind } from "@/lib/games/game-media-contract";
import { eq, inArray } from "drizzle-orm";

export type GameMediaActiveProjection = {
  thumbnailMediaAssetId: string | null;
  coverMediaAssetId: string | null;
  previewVideoMediaAssetId: string | null;
};

export const EMPTY_GAME_MEDIA_ACTIVE: GameMediaActiveProjection = {
  thumbnailMediaAssetId: null,
  coverMediaAssetId: null,
  previewVideoMediaAssetId: null,
};

export const projectGameMediaAssignments = (
  assignments: ReadonlyArray<
    Pick<typeof gameMediaAssignments.$inferSelect, "kind" | "assetId">
  >,
): GameMediaActiveProjection => {
  const active = { ...EMPTY_GAME_MEDIA_ACTIVE };

  for (const assignment of assignments) {
    switch (assignment.kind) {
      case "thumbnail":
        active.thumbnailMediaAssetId = assignment.assetId;
        break;
      case "cover":
        active.coverMediaAssetId = assignment.assetId;
        break;
      case "preview_video":
        active.previewVideoMediaAssetId = assignment.assetId;
        break;
    }
  }

  return active;
};

export const getActiveGameMediaAssetId = (
  active: GameMediaActiveProjection,
  kind: GameMediaKind,
): string | null => {
  switch (kind) {
    case "thumbnail":
      return active.thumbnailMediaAssetId;
    case "cover":
      return active.coverMediaAssetId;
    case "preview_video":
      return active.previewVideoMediaAssetId;
  }
};

export const loadGameMediaActive = async ({
  gameId,
  database = db,
}: {
  gameId: string;
  database?: typeof db;
}): Promise<GameMediaActiveProjection> => {
  const assignments = await database
    .select({
      kind: gameMediaAssignments.kind,
      assetId: gameMediaAssignments.assetId,
    })
    .from(gameMediaAssignments)
    .where(eq(gameMediaAssignments.gameId, gameId));

  return projectGameMediaAssignments(assignments);
};

export const loadGameMediaActiveByGame = async ({
  gameIds,
  database = db,
}: {
  gameIds: readonly string[];
  database?: typeof db;
}): Promise<Map<string, GameMediaActiveProjection>> => {
  const activeByGame = new Map<string, GameMediaActiveProjection>();
  if (gameIds.length === 0) {
    return activeByGame;
  }

  const assignments = await database
    .select({
      gameId: gameMediaAssignments.gameId,
      kind: gameMediaAssignments.kind,
      assetId: gameMediaAssignments.assetId,
    })
    .from(gameMediaAssignments)
    .where(inArray(gameMediaAssignments.gameId, [...gameIds]));

  for (const gameId of gameIds) {
    activeByGame.set(
      gameId,
      projectGameMediaAssignments(
        assignments.filter((assignment) => assignment.gameId === gameId),
      ),
    );
  }

  return activeByGame;
};
