import { db } from "@/db";
import { gameMediaAssets, games } from "@/db/schema";
import {
  gameMediaKindSchema,
  gameMediaStatusSchema,
} from "@/lib/games/game-media-contract";
import { MAX_GAME_MEDIA_BYTES } from "@/lib/games/game-media-policy";
import { assertOwnedGame } from "@/server/games/assert-owned-game";
import {
  archiveGameMediaAsset,
  assignGameMediaAsset,
  finalizeGameMediaUpload,
  requestGameMediaUploadTarget,
} from "@/server/media/game-media-service";
import { buildManagedGameMediaUrl } from "@/server/media/game-media-public-url";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const requestUploadTargetInput = z.object({
  gameId: z.string(),
  kind: gameMediaKindSchema,
  originalFilename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(Math.max(...Object.values(MAX_GAME_MEDIA_BYTES))),
});

const mediaAssetMutationInput = z.object({
  gameId: z.string(),
  assetId: z.string(),
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
  kind: "thumbnail" | "cover" | "preview_video";
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

export const gameMediaRouter = createTRPCRouter({
  listByGame: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ input, ctx }) => {
      const game = await assertOwnedGame(input.gameId, ctx.user.id);
      const assets = await db.query.gameMediaAssets.findMany({
        where: (table, { eq }) => eq(table.gameId, input.gameId),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      });

      return {
        active: {
          thumbnailMediaAssetId: game.thumbnailMediaAssetId,
          coverMediaAssetId: game.coverMediaAssetId,
          previewVideoMediaAssetId: game.previewVideoMediaAssetId,
        },
        assets: assets.map((asset) => ({
          ...asset,
          activeAssetId: getActiveAssetIdByKind({
            game,
            kind: asset.kind,
          }),
          isActive:
            getActiveAssetIdByKind({
              game,
              kind: asset.kind,
            }) === asset.id,
          publicUrl: buildManagedGameMediaUrl({
            gameId: input.gameId,
            assetId: asset.status === "ready" ? asset.id : null,
            kind: asset.kind,
          }),
        })),
      };
    }),

  requestUploadTarget: protectedProcedure
    .input(requestUploadTargetInput)
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      return requestGameMediaUploadTarget(input);
    }),

  finalizeUpload: protectedProcedure
    .input(mediaAssetMutationInput)
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      return finalizeGameMediaUpload(input);
    }),

  assignAsset: protectedProcedure
    .input(mediaAssetMutationInput)
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      return assignGameMediaAsset(input);
    }),

  archiveAsset: protectedProcedure
    .input(mediaAssetMutationInput)
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      return archiveGameMediaAsset(input);
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        assetId: z.string(),
        status: gameMediaStatusSchema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);

      const [updatedAsset] = await db
        .update(gameMediaAssets)
        .set({
          status: input.status,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(gameMediaAssets.id, input.assetId),
            eq(gameMediaAssets.gameId, input.gameId),
          ),
        )
        .returning();

      if (!updatedAsset) {
        throw new Error("Media asset not found.");
      }

      if (input.status === "archived") {
        const game = await db.query.games.findFirst({
          where: (table, { eq }) => eq(table.id, input.gameId),
        });

        if (game) {
          const activeAssetId = getActiveAssetIdByKind({
            game,
            kind: updatedAsset.kind,
          });

          if (activeAssetId === updatedAsset.id) {
            const clearColumn =
              updatedAsset.kind === "thumbnail"
                ? { thumbnailMediaAssetId: null }
                : updatedAsset.kind === "cover"
                  ? { coverMediaAssetId: null }
                  : { previewVideoMediaAssetId: null };

            await db
              .update(games)
              .set({
                ...clearColumn,
                updatedAt: new Date(),
              })
              .where(eq(games.id, input.gameId));
          }
        }
      }

      return updatedAsset;
    }),
});
