import { analyticsRouter } from "./routers/analytics";
import { gameRouter } from "./routers/game";
import { userRouter } from "./routers/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  analytics: analyticsRouter,
  game: gameRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
