import type { ProxyHeaderTrustMode } from "../env/server-env.js";

/**
 * Connection attempts per address, counted in fixed windows, for the room
 * server's front door. One process holds the counts.
 */
const normalizeIp = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice("::ffff:".length);
  }

  return trimmed;
};

const isPrivateOrLoopbackIp = (value: string | null | undefined): boolean => {
  const normalized = normalizeIp(value);
  if (!normalized) {
    return false;
  }

  if (normalized === "::1" || normalized === "localhost") {
    return true;
  }

  const ipv4Match = normalized.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const [firstOctet, secondOctet] = ipv4Match
      .slice(1, 3)
      .map((segment) => Number.parseInt(segment, 10));

    return (
      firstOctet === 10 ||
      firstOctet === 127 ||
      (firstOctet === 192 && secondOctet === 168) ||
      (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31)
    );
  }

  const lowerCase = normalized.toLowerCase();
  return lowerCase.startsWith("fc") || lowerCase.startsWith("fd");
};

const extractForwardedClientIp = (
  forwardedForHeader: string | string[] | undefined,
): string | null => {
  const rawValue =
    typeof forwardedForHeader === "string"
      ? forwardedForHeader
      : Array.isArray(forwardedForHeader)
        ? forwardedForHeader[0]
        : undefined;

  if (!rawValue) {
    return null;
  }

  return normalizeIp(rawValue.split(",")[0]);
};

/** The address a connection attempt is counted against. */
export const resolveClientAddress = (
  forwardedForHeader: string | string[] | undefined,
  handshakeAddress: string | undefined,
  socketId: string,
  proxyHeaderTrustMode: ProxyHeaderTrustMode = "auto",
): string => {
  const forwardedClientIp = extractForwardedClientIp(forwardedForHeader);
  const normalizedHandshakeAddress = normalizeIp(handshakeAddress);
  const shouldTrustForwardedHeader =
    proxyHeaderTrustMode === "enabled" ||
    (proxyHeaderTrustMode === "auto" &&
      isPrivateOrLoopbackIp(normalizedHandshakeAddress));

  if (shouldTrustForwardedHeader && forwardedClientIp) {
    return forwardedClientIp;
  }

  return normalizedHandshakeAddress || socketId;
};

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

  constructor(readonly now: () => number = Date.now) {}

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    if (limit <= 0 || windowMs <= 0) {
      return { allowed: true, retryAfterMs: 0 };
    }

    const now = this.now();
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
