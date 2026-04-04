import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { assertOwnedGame } from "@/server/games/assert-owned-game";
import {
  getGameAnalyticsOverview,
  getRecentGameAnalyticsSessions,
} from "@/server/analytics/game-analytics";
import { getGameAnalyticsDebugSnapshot } from "@/server/analytics/game-analytics-debug";

export const analyticsRouter = createTRPCRouter({
  getGameOverview: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        days: z.number().int().min(1).max(90).default(14),
      }),
    )
    .query(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      return await getGameAnalyticsOverview(input.gameId, input.days);
    }),

  getRecentGameSessions: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        limit: z.number().int().min(1).max(25).default(8),
      }),
    )
    .query(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      return await getRecentGameAnalyticsSessions(input.gameId, input.limit);
    }),

  getGameDebugSnapshot: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      await assertOwnedGame(input.gameId, ctx.user.id);
      return await getGameAnalyticsDebugSnapshot(input.gameId);
    }),
});
