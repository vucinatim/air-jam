interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterMs: number;
}

/**
 * Minimal in-memory fixed-window limiter.
 * Good enough for single-instance deployments and lightweight abuse protection.
 */
export class RateLimitService {
  private entries = new Map<string, RateLimitEntry>();
  private checks = 0;

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    if (limit <= 0 || windowMs <= 0) {
      return { allowed: true, retryAfterMs: 0 };
    }

    const now = Date.now();
    const existing = this.entries.get(key);

    if (!existing || now >= existing.resetAt) {
      this.entries.set(key, { count: 1, resetAt: now + windowMs });
      this.maybeCleanup(now);
      return { allowed: true, retryAfterMs: 0 };
    }

    if (existing.count >= limit) {
      this.maybeCleanup(now);
      return {
        allowed: false,
        retryAfterMs: Math.max(existing.resetAt - now, 0),
      };
    }

    existing.count += 1;
    this.entries.set(key, existing);
    this.maybeCleanup(now);
    return { allowed: true, retryAfterMs: 0 };
  }

  private maybeCleanup(now: number): void {
    this.checks += 1;
    if (this.checks % 200 !== 0) {
      return;
    }

    for (const [key, entry] of this.entries) {
      if (now >= entry.resetAt) {
        this.entries.delete(key);
      }
    }
  }
}

export const rateLimitService = new RateLimitService();
