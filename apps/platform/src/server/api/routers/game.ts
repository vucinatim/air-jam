import { db } from "@/db";
import { apiKeys, games } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";

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
        minPlayers: z.number().int().min(1).optional(),
        maxPlayers: z.number().int().min(1).nullable().optional(),
        isPublished: z.boolean().optional(),
        orientation: z.enum(["landscape", "portrait", "any"]).optional(),
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
