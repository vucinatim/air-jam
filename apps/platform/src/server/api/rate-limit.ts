/**
 * Simple in-process token-bucket rate limiter for tRPC mutations.
 *
 * Scoped to the single-instance v1 launch profile. When we move to
 * multiple server instances, this needs to move to Redis or the shared
 * server-side rate-limit service.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Probabilistic cleanup so the map does not grow unbounded under light load.
let checkCount = 0;
const CLEANUP_EVERY_N_CHECKS = 500;

const sweepExpired = (now: number): void => {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
};

export interface RateLimitConfig {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum allowed hits per window. */
  max: number;
}

export interface RateLimitResult {
  limited: boolean;
  /** Seconds until the window resets (rounded up). */
  retryAfter: number;
  remaining: number;
}

/**
 * Check whether a request identified by `key` is rate-limited, and atomically
 * increment the bucket if it is not.
 */
export const checkRateLimit = (
  key: string,
  config: RateLimitConfig,
): RateLimitResult => {
  const now = Date.now();

  checkCount += 1;
  if (checkCount >= CLEANUP_EVERY_N_CHECKS) {
    checkCount = 0;
    sweepExpired(now);
  }

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });
    return {
      limited: false,
      retryAfter: 0,
      remaining: config.max - 1,
    };
  }

  if (existing.count >= config.max) {
    return {
      limited: true,
      retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
      remaining: 0,
    };
  }

  existing.count += 1;
  return {
    limited: false,
    retryAfter: 0,
    remaining: config.max - existing.count,
  };
};

/**
 * Test-only helper. Not exported from index — intentionally only available
 * inside the platform package so tests can reset the limiter between runs.
 */
export const __resetRateLimitState = (): void => {
  buckets.clear();
  checkCount = 0;
};
