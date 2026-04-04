import type { RateLimitService } from "../services/rate-limit-service.js";

export const resolveSocketIdentifier = (
  forwardedForHeader: string | string[] | undefined,
  handshakeAddress: string | undefined,
  socketId: string,
): string => {
  return (
    (typeof forwardedForHeader === "string" &&
      forwardedForHeader.split(",")[0]?.trim()) ||
    (Array.isArray(forwardedForHeader) &&
      forwardedForHeader[0]?.split(",")[0]?.trim()) ||
    handshakeAddress ||
    socketId
  );
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
