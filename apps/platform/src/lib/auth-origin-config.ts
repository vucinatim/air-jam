import {
  PLATFORM_PUBLIC_URL_FALLBACK,
  resolvePlatformPublicUrl,
} from "./platform-public-url";

const normalizeOrigin = (rawUrl: string | undefined): string | null => {
  if (!rawUrl?.trim()) {
    return null;
  }

  try {
    return new URL(
      rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
        ? rawUrl
        : `https://${rawUrl}`,
    ).origin;
  } catch {
    return null;
  }
};

const splitTrustedOrigins = (rawValue: string | undefined): string[] => {
  if (!rawValue?.trim()) {
    return [];
  }

  return rawValue
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));
};

export const resolveAuthBaseUrl = (
  env: NodeJS.ProcessEnv = process.env,
): string => {
  const explicitBaseUrl = normalizeOrigin(env.BETTER_AUTH_URL);
  if (explicitBaseUrl) {
    return explicitBaseUrl;
  }

  return resolvePlatformPublicUrl(env) || PLATFORM_PUBLIC_URL_FALLBACK;
};

export const resolveAuthTrustedOrigins = (
  env: NodeJS.ProcessEnv = process.env,
): string[] => {
  const candidates = new Set<string>();

  for (const value of [
    resolveAuthBaseUrl(env),
    normalizeOrigin(env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST),
    normalizeOrigin(env.NEXT_PUBLIC_APP_URL),
    normalizeOrigin(env.VERCEL_URL),
    ...splitTrustedOrigins(env.BETTER_AUTH_TRUSTED_ORIGINS),
  ]) {
    if (value) {
      candidates.add(value);
    }
  }

  return [...candidates];
};
