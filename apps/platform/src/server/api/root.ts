import { createTRPCRouter } from "./trpc";
import { gameRouter } from "./routers/game";

export const appRouter = createTRPCRouter({
  game: gameRouter,
});

export type AppRouter = typeof appRouter;
