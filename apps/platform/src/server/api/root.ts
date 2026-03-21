import { gameRouter } from "./routers/game";
import { userRouter } from "./routers/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  game: gameRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
