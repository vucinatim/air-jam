import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { assertOpsAdmin } from "@/server/auth/assert-ops-admin";
import { checkRateLimit, type RateLimitConfig } from "@/server/api/rate-limit";
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import superjson from "superjson";
import { ZodError } from "zod";

const resolveClientIp = (headers: Headers): string => {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
};

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth.api.getSession({
    headers: opts.headers,
  });

  const user = session?.user?.id
    ? await db.query.users.findFirst({
        where: eq(users.id, session.user.id),
      })
    : null;

  return {
    ...opts,
    session,
    user,
    clientIp: resolveClientIp(opts.headers),
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      // infers the `session` as non-nullable
      session: ctx.session,
      user: ctx.user,
    },
  });
});

export const opsProcedure = protectedProcedure.use(({ ctx, next }) => {
  assertOpsAdmin(ctx.user);

  return next({
    ctx,
  });
});

/**
 * Apply per-(IP, procedure) rate limiting to a protected mutation.
 *
 * Usage: `protectedProcedure.use(rateLimitMiddleware("game.create", { windowMs: 60_000, max: 10 }))`
 */
export const rateLimitMiddleware = (
  bucketName: string,
  config: RateLimitConfig,
) =>
  t.middleware(({ ctx, next, path }) => {
    const key = `${bucketName}:${path}:${ctx.clientIp}`;
    const result = checkRateLimit(key, config);
    if (result.limited) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded for ${bucketName}. Retry in ${result.retryAfter}s.`,
      });
    }
    return next();
  });

/** Default windows for sensitive mutation categories. */
export const RATE_LIMITS = {
  gameCreate: { windowMs: 60_000, max: 10 },
  releaseCreate: { windowMs: 60_000, max: 20 },
  mediaMutation: { windowMs: 60_000, max: 30 },
} as const;
