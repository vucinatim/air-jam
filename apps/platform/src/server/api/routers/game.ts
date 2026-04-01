import { db } from "@/db";
import {
  appIds,
  gameReleaseArtifacts,
  gameReleases,
  games,
  users,
} from "@/db/schema";
import { arcadeVisibilitySchema } from "@/lib/games/arcade-visibility";
import { HOSTED_RELEASE_HOST_PATH } from "@/lib/releases/hosted-release-artifact";
import { assertOwnedGame } from "@/server/games/assert-owned-game";
import { buildManagedGameMediaUrl } from "@/server/media/game-media-public-url";
import {
  buildHostedReleaseSnapshot,
  findPublicReleaseBySlugOrId,
  getLiveReleaseForGame,
} from "@/server/releases/public-release-record";
import { buildHostedReleaseAssetUrl } from "@/server/releases/release-public-url";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const normalizeAllowedOrigins = (values: string[]): string[] => {
  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new URL(value).origin);

  return Array.from(new Set(normalized));
};

const addManagedGameMediaUrls = <
  T extends {
    id: string;
    thumbnailMediaAssetId: string | null;
    coverMediaAssetId: string | null;
    previewVideoMediaAssetId: string | null;
  },
>(
  game: T,
) => ({
  ...game,
  thumbnailUrl: buildManagedGameMediaUrl({
    gameId: game.id,
    assetId: game.thumbnailMediaAssetId,
    kind: "thumbnail",
  }),
  coverUrl: buildManagedGameMediaUrl({
    gameId: game.id,
    assetId: game.coverMediaAssetId,
    kind: "cover",
  }),
  videoUrl: buildManagedGameMediaUrl({
    gameId: game.id,
    assetId: game.previewVideoMediaAssetId,
    kind: "preview_video",
  }),
});

export const gameRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        url: z.string().url().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const gameId = crypto.randomUUID();

      // Create game
      const [game] = await db
        .insert(games)
        .values({
          id: gameId,
          name: input.name,
          url: input.url ?? null,
          userId: ctx.user.id,
        })
        .returning();

      // Auto-generate app ID for the game
      const appId = `aj_app_${crypto.randomUUID().replace(/-/g, "")}`;
      await db.insert(appIds).values({
        id: crypto.randomUUID(),
        gameId: gameId,
        key: appId,
      });

      return game;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const ownedGames = await db
      .select()
      .from(games)
      .where(eq(games.userId, ctx.user.id));

    return ownedGames.map(addManagedGameMediaUrls);
  }),

  getAllPublic: publicProcedure.query(async () => {
    const rows = await db
      .select({
        id: games.id,
        name: games.name,
        slug: games.slug,
        thumbnailMediaAssetId: games.thumbnailMediaAssetId,
        previewVideoMediaAssetId: games.previewVideoMediaAssetId,
        coverMediaAssetId: games.coverMediaAssetId,
        ownerName: users.name,
        releaseId: gameReleases.id,
        releaseVersionLabel: gameReleases.versionLabel,
        releasePublishedAt: gameReleases.publishedAt,
      })
      .from(games)
      .innerJoin(users, eq(games.userId, users.id))
      .innerJoin(
        gameReleases,
        and(eq(gameReleases.gameId, games.id), eq(gameReleases.status, "live")),
      )
      .innerJoin(
        gameReleaseArtifacts,
        eq(gameReleaseArtifacts.releaseId, gameReleases.id),
      )
      .where(eq(games.arcadeVisibility, "listed"));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      url: buildHostedReleaseAssetUrl({
        gameId: row.id,
        releaseId: row.releaseId,
        assetPath: HOSTED_RELEASE_HOST_PATH,
      }),
      thumbnailUrl: buildManagedGameMediaUrl({
        gameId: row.id,
        assetId: row.thumbnailMediaAssetId,
        kind: "thumbnail",
      }),
      videoUrl: buildManagedGameMediaUrl({
        gameId: row.id,
        assetId: row.previewVideoMediaAssetId,
        kind: "preview_video",
      }),
      coverUrl: buildManagedGameMediaUrl({
        gameId: row.id,
        assetId: row.coverMediaAssetId,
        kind: "cover",
      }),
      ownerName: row.ownerName,
      liveRelease: buildHostedReleaseSnapshot({
        gameId: row.id,
        releaseId: row.releaseId,
        versionLabel: row.releaseVersionLabel,
        publishedAt: row.releasePublishedAt,
      }),
    }));
  }),

  /** Look up a game by slug first, then fall back to ID. Public for shareable URLs. */
  getBySlugOrId: publicProcedure
    .input(z.object({ slugOrId: z.string() }))
    .query(async ({ input, ctx }) => {
      let game = await db.query.games.findFirst({
        where: (table, { eq }) => eq(table.slug, input.slugOrId),
      });
      if (!game) {
        game = await db.query.games.findFirst({
          where: (table, { eq }) => eq(table.id, input.slugOrId),
        });
      }

      if (!game) {
        throw new Error("Game not found");
      }

      const isOwner = ctx.user?.id === game.userId;
      const liveRelease = await getLiveReleaseForGame(game.id);

      if (isOwner) {
        if (game.url) {
          return {
            ...addManagedGameMediaUrls(game),
            url: game.url,
            selfHostedUrl: game.url,
            launchSource: "self_hosted" as const,
            liveRelease,
          };
        }

        if (liveRelease) {
          return {
            ...addManagedGameMediaUrls(game),
            url: liveRelease.url,
            selfHostedUrl: game.url,
            launchSource: "hosted_release" as const,
            liveRelease,
          };
        }

        throw new Error(
          "This game does not have a preview URL or a live hosted release yet.",
        );
      }

      const publicRelease = await findPublicReleaseBySlugOrId(input.slugOrId);

      return {
        ...addManagedGameMediaUrls(publicRelease.game),
        url: publicRelease.liveRelease.url,
        selfHostedUrl: publicRelease.game.url,
        launchSource: "hosted_release" as const,
        liveRelease: publicRelease.liveRelease,
      };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const game = await assertOwnedGame(input.id, ctx.user.id);
      return addManagedGameMediaUrls(game);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        description: z.string().optional(),
        url: z.string().url().nullable().optional(),
        arcadeVisibility: arcadeVisibilitySchema.optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      await assertOwnedGame(id, ctx.user.id);

      if (data.arcadeVisibility === "listed") {
        const liveRelease = await db.query.gameReleases.findFirst({
          where: (table, { and, eq }) =>
            and(eq(table.gameId, id), eq(table.status, "live")),
        });

        if (!liveRelease) {
          throw new Error(
            "A game can only be listed in Arcade after a hosted release is made live.",
          );
        }
      }

      try {
        const [updatedGame] = await db
          .update(games)
          .set({
            ...data,
            updatedAt: new Date(),
          })
          .where(eq(games.id, id))
          .returning();
        return updatedGame;
      } catch (error) {
        if (error instanceof Error && error.message.includes("23505")) {
          // Postgres unique violation code
          throw new Error("Slug already taken. Please choose another one.");
        }
        throw error;
      }
    }),

  getAppId: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);

      const appId = await db.query.appIds.findFirst({
        where: (appIds, { eq }) => eq(appIds.gameId, input.gameId),
      });

      return appId;
    }),

  /** Check if a slug is available (excludes the current game if editing) */
  checkSlugAvailability: protectedProcedure
    .input(
      z.object({
        slug: z.string().min(1),
        excludeGameId: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const existingGame = await db.query.games.findFirst({
        where: (games, { eq }) => eq(games.slug, input.slug),
      });

      // Available if no game has this slug, or if it's the current game being edited
      const isAvailable =
        !existingGame || existingGame.id === input.excludeGameId;

      return { available: isAvailable };
    }),

  regenerateAppId: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);

      // Generate new app ID
      const newKey = `aj_app_${crypto.randomUUID().replace(/-/g, "")}`;

      // Update existing app ID record
      const [updatedAppId] = await db
        .update(appIds)
        .set({
          key: newKey,
          isActive: true,
          lastUsedAt: null, // Reset last used timestamp
        })
        .where(eq(appIds.gameId, input.gameId))
        .returning();

      return updatedAppId;
    }),

  updateAppIdPolicy: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        allowedOrigins: z.array(z.string().url()).default([]),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);

      const normalizedAllowedOrigins = normalizeAllowedOrigins(
        input.allowedOrigins,
      );

      const [updatedAppId] = await db
        .update(appIds)
        .set({
          allowedOrigins:
            normalizedAllowedOrigins.length > 0
              ? normalizedAllowedOrigins
              : null,
        })
        .where(eq(appIds.gameId, input.gameId))
        .returning();

      return updatedAppId;
    }),
});
