import { db } from "@/db";
import { appIds, games, users } from "@/db/schema";
import { assertOwnedGame } from "@/server/games/assert-owned-game";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const normalizeAllowedOrigins = (values: string[]): string[] => {
  const normalized = values
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => new URL(value).origin);

  return Array.from(new Set(normalized));
};

export const gameRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), url: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      const gameId = crypto.randomUUID();

      // Create game
      const [game] = await db
        .insert(games)
        .values({
          id: gameId,
          name: input.name,
          url: input.url,
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
    return await db.select().from(games).where(eq(games.userId, ctx.user.id));
  }),

  getAllPublic: publicProcedure.query(async () => {
    return await db
      .select({
        id: games.id,
        name: games.name,
        slug: games.slug,
        url: games.url,
        thumbnailUrl: games.thumbnailUrl,
        videoUrl: games.videoUrl,
        coverUrl: games.coverUrl,
        ownerName: users.name,
      })
      .from(games)
      .innerJoin(users, eq(games.userId, users.id))
      .where(eq(games.isPublished, true));
  }),

  /** Look up a game by slug first, then fall back to ID. Public for shareable URLs. */
  getBySlugOrId: publicProcedure
    .input(z.object({ slugOrId: z.string() }))
    .query(async ({ input }) => {
      // Try slug first
      let game = await db.query.games.findFirst({
        where: (games, { eq }) => eq(games.slug, input.slugOrId),
      });
      // Fall back to ID
      if (!game) {
        game = await db.query.games.findFirst({
          where: (games, { eq }) => eq(games.id, input.slugOrId),
        });
      }
      if (!game) throw new Error("Game not found");
      return game;
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return await assertOwnedGame(input.id, ctx.user.id);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        description: z.string().optional(),
        url: z.string().url().optional(),
        thumbnailUrl: z.string().url().optional().or(z.literal("")),
        videoUrl: z.string().url().optional().or(z.literal("")),
        coverUrl: z.string().url().optional().or(z.literal("")),
        isPublished: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      await assertOwnedGame(id, ctx.user.id);

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
