import { gameRouter } from "./routers/game";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  game: gameRouter,
});

export type AppRouter = typeof appRouter;
