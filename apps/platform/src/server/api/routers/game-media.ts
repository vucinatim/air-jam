import { gameMediaKindSchema } from "@/lib/games/game-media-contract";
import { MAX_GAME_MEDIA_BYTES } from "@/lib/games/game-media-policy";
import {
  archiveOwnedGameMediaAsset,
  assignOwnedGameMediaAsset,
  finalizeOwnedGameMediaUpload,
  inspectOwnedGameMedia,
  requestOwnedGameMediaUploadTarget,
} from "@/server/media/game-media-application-service";
import { projectGameMediaAsset } from "@/server/media/game-media-projection";
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
      const { active, assets } = await inspectOwnedGameMedia({
        actor: { userId: ctx.user.id },
        gameReference: { kind: "id", gameId: input.gameId },
      });

      return {
        active,
        assets: assets.map((asset) => projectGameMediaAsset({ asset, active })),
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
      const { asset, upload } = await requestOwnedGameMediaUploadTarget({
        actor: { userId: ctx.user.id },
        gameReference: { kind: "id", gameId: input.gameId },
        kind: input.kind,
        originalFilename: input.originalFilename,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      });
      return { asset, upload };
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
      const { asset } = await finalizeOwnedGameMediaUpload({
        actor: { userId: ctx.user.id },
        gameReference: { kind: "id", gameId: input.gameId },
        assetId: input.assetId,
      });
      return asset;
    }),

  assignAsset: protectedProcedure
    .use(
      rateLimitMiddleware("gameMedia.assignAsset", RATE_LIMITS.mediaMutation),
    )
    .input(mediaAssetMutationInput)
    .mutation(async ({ input, ctx }) => {
      const { asset } = await assignOwnedGameMediaAsset({
        actor: { userId: ctx.user.id },
        gameReference: { kind: "id", gameId: input.gameId },
        assetId: input.assetId,
      });
      return asset;
    }),

  archiveAsset: protectedProcedure
    .use(
      rateLimitMiddleware("gameMedia.archiveAsset", RATE_LIMITS.mediaMutation),
    )
    .input(mediaAssetMutationInput)
    .mutation(async ({ input, ctx }) => {
      const { asset } = await archiveOwnedGameMediaAsset({
        actor: { userId: ctx.user.id },
        gameReference: { kind: "id", gameId: input.gameId },
        assetId: input.assetId,
      });
      return asset;
    }),
});
