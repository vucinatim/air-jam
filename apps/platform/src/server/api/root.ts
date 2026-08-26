import { analyticsRouter } from "./routers/analytics";
import { gameRouter } from "./routers/game";
import { gameMediaRouter } from "./routers/game-media";
import { productTelemetryRouter } from "./routers/product-telemetry";
import { releaseRouter } from "./routers/release";
import { userRouter } from "./routers/user";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  analytics: analyticsRouter,
  game: gameRouter,
  gameMedia: gameMediaRouter,
  productTelemetry: productTelemetryRouter,
  release: releaseRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
