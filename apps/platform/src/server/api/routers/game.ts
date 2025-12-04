import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { games, apiKeys } from "@/db/schema";
import { db } from "@/db";
import { eq } from "drizzle-orm";

export const gameRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), url: z.string().url() }))
    .mutation(async ({ input, ctx }) => {
      const [game] = await db
        .insert(games)
        .values({
          id: crypto.randomUUID(),
          name: input.name,
          url: input.url,
          userId: ctx.user.id,
        })
        .returning();

      return game;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return await db.select().from(games).where(eq(games.userId, ctx.user.id));
  }),

  createApiKey: protectedProcedure
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

      const key = `aj_live_${crypto.randomUUID().replace(/-/g, "")}`;
      const [apiKey] = await db
        .insert(apiKeys)
        .values({
          id: crypto.randomUUID(),
          gameId: input.gameId,
          key: key,
        })
        .returning();
      return apiKey;
    }),

  getApiKeys: protectedProcedure
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

      return await db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.gameId, input.gameId));
    }),
});
