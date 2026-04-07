import type { RateLimitService } from "../services/rate-limit-service.js";

export type ProxyHeaderTrustMode = "auto" | "enabled" | "disabled";

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

export const resolveSocketIdentifier = (
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

export const createRateLimitGuard = (
  rateLimitService: RateLimitService,
  socketIdentifier: string,
  windowMs: number,
): ((bucket: string, limit: number) => boolean) => {
  return (bucket: string, limit: number): boolean => {
    const result = rateLimitService.check(
      `${bucket}:${socketIdentifier}`,
      limit,
      windowMs,
    );
    return !result.allowed;
  };
};

export const createScopedRateLimitGuard = (
  rateLimitService: RateLimitService,
  windowMs: number,
): ((bucket: string, scope: string, limit: number) => boolean) => {
  return (bucket: string, scope: string, limit: number): boolean => {
    const result = rateLimitService.check(`${bucket}:${scope}`, limit, windowMs);
    return !result.allowed;
  };
};
