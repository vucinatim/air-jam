import { db } from "@/db";
import { apiKeys, games } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

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

      // Auto-generate API key for the game
      const apiKey = `aj_live_${crypto.randomUUID().replace(/-/g, "")}`;
      await db.insert(apiKeys).values({
        id: crypto.randomUUID(),
        gameId: gameId,
        key: apiKey,
      });

      return game;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.select().from(games).where(eq(games.userId, ctx.user.id));
  }),

  getAllPublic: publicProcedure.query(async () => {
    return await db.select().from(games).where(eq(games.isPublished, true));
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
      const game = await db.query.games.findFirst({
        where: (games, { eq, and }) =>
          and(eq(games.id, input.id), eq(games.userId, ctx.user.id)),
      });
      if (!game) throw new Error("Game not found");
      return game;
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
        coverUrl: z.string().url().optional().or(z.literal("")),
        isPublished: z.boolean().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const game = await db.query.games.findFirst({
        where: (games, { eq, and }) =>
          and(eq(games.id, id), eq(games.userId, ctx.user.id)),
      });

      if (!game) {
        throw new Error("Game not found or unauthorized");
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

  getApiKey: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Verify game belongs to user
      const game = await db.query.games.findFirst({
        where: (games, { eq, and }) =>
          and(eq(games.id, input.gameId), eq(games.userId, ctx.user.id)),
      });

      if (!game) {
        throw new Error("Game not found or unauthorized");
      }

      const apiKey = await db.query.apiKeys.findFirst({
        where: (apiKeys, { eq }) => eq(apiKeys.gameId, input.gameId),
      });

      return apiKey;
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

  regenerateApiKey: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Verify game belongs to user
      const game = await db.query.games.findFirst({
        where: (games, { eq, and }) =>
          and(eq(games.id, input.gameId), eq(games.userId, ctx.user.id)),
      });

      if (!game) {
        throw new Error("Game not found or unauthorized");
      }

      // Generate new API key
      const newKey = `aj_live_${crypto.randomUUID().replace(/-/g, "")}`;

      // Update existing API key record
      const [updatedApiKey] = await db
        .update(apiKeys)
        .set({
          key: newKey,
          isActive: true,
          lastUsedAt: null, // Reset last used timestamp
        })
        .where(eq(apiKeys.gameId, input.gameId))
        .returning();

      return updatedApiKey;
    }),
});
