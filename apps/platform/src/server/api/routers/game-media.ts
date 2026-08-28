import { gameMediaKindSchema } from "@/lib/games/game-media-contract";
import { MAX_GAME_MEDIA_BYTES } from "@/lib/games/game-media-policy";
import { assertOwnedGame } from "@/server/games/assert-owned-game";
import { getActiveGameMediaAssetId } from "@/server/media/game-media-assignments";
import { buildManagedGameMediaUrl } from "@/server/media/game-media-public-url";
import {
  archiveGameMediaAsset,
  assignGameMediaAsset,
  finalizeGameMediaUpload,
  inspectGameMedia,
  requestGameMediaUploadTarget,
} from "@/server/media/game-media-service";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedProcedure,
  RATE_LIMITS,
  rateLimitMiddleware,
} from "../trpc";

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

export const gameMediaRouter = createTRPCRouter({
  listByGame: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      const { active, assets } = await inspectGameMedia({
        gameId: input.gameId,
      });

      return {
        active,
        assets: assets.map((asset) => ({
          ...asset,
          activeAssetId: getActiveGameMediaAssetId(active, asset.kind),
          isActive: getActiveGameMediaAssetId(active, asset.kind) === asset.id,
          publicUrl: buildManagedGameMediaUrl({
            gameId: input.gameId,
            assetId: asset.status === "ready" ? asset.id : null,
            kind: asset.kind,
          }),
        })),
      };
    }),

  requestUploadTarget: protectedProcedure
    .use(
      rateLimitMiddleware(
        "gameMedia.requestUploadTarget",
        RATE_LIMITS.mediaMutation,
      ),
    )
    .input(requestUploadTargetInput)
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      return requestGameMediaUploadTarget(input);
    }),

  finalizeUpload: protectedProcedure
    .use(
      rateLimitMiddleware(
        "gameMedia.finalizeUpload",
        RATE_LIMITS.mediaMutation,
      ),
    )
    .input(mediaAssetMutationInput)
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      return finalizeGameMediaUpload(input);
    }),

  assignAsset: protectedProcedure
    .use(
      rateLimitMiddleware("gameMedia.assignAsset", RATE_LIMITS.mediaMutation),
    )
    .input(mediaAssetMutationInput)
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      return assignGameMediaAsset(input);
    }),

  archiveAsset: protectedProcedure
    .use(
      rateLimitMiddleware("gameMedia.archiveAsset", RATE_LIMITS.mediaMutation),
    )
    .input(mediaAssetMutationInput)
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      return archiveGameMediaAsset(input);
    }),
});
