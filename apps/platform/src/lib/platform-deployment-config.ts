const LOCAL_FALLBACK = "http://localhost:3000";

const trimToUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const normalizeUrl = (rawUrl: string): string => {
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
    return rawUrl;
  }

  return `https://${rawUrl}`;
};

const normalizePublicUrl = (rawUrl: string | undefined): string | null => {
  const trimmed = trimToUndefined(rawUrl);
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(normalizeUrl(trimmed)).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
};

const normalizeOrigin = (rawUrl: string | undefined): string | null => {
  const normalized = normalizePublicUrl(rawUrl);
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).origin;
  } catch {
    return null;
  }
};

const splitTrustedOrigins = (rawValue: string | undefined): string[] => {
  const trimmed = trimToUndefined(rawValue);
  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(",")
    .map((value) => normalizeOrigin(value))
    .filter((value): value is string => Boolean(value));
};

const resolveBooleanEnv = (
  explicitValue: string | undefined,
  fallback: boolean,
): boolean => {
  const trimmed = trimToUndefined(explicitValue);
  if (!trimmed) {
    return fallback;
  }

  if (trimmed === "true") {
    return true;
  }

  if (trimmed === "false") {
    return false;
  }

  return fallback;
};

export type PlatformDeploymentConfig = {
  platformPublicUrl: string;
  platformPublicOrigin: string;
  hasExplicitPlatformPublicOrigin: boolean;
  backendPublicUrl: string;
  authBaseUrl: string;
  authTrustedOrigins: string[];
  githubAuthEnabled: boolean;
  appId: string | undefined;
  systemHostGrantEndpoint: string | undefined;
};

export const PLATFORM_PUBLIC_URL_FALLBACK = LOCAL_FALLBACK;

export const resolvePlatformDeploymentConfig = (
  env: NodeJS.ProcessEnv = process.env,
): PlatformDeploymentConfig => {
  const explicitPublicUrl =
    normalizePublicUrl(env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST) ??
    normalizePublicUrl(env.NEXT_PUBLIC_APP_URL) ??
    normalizePublicUrl(env.RAILWAY_PUBLIC_DOMAIN) ??
    normalizePublicUrl(env.VERCEL_URL);

  const platformPublicUrl = explicitPublicUrl ?? PLATFORM_PUBLIC_URL_FALLBACK;
  const platformPublicOrigin =
    normalizeOrigin(platformPublicUrl) ?? PLATFORM_PUBLIC_URL_FALLBACK;
  const authBaseUrl =
    normalizeOrigin(env.BETTER_AUTH_URL) ?? platformPublicOrigin;

  const authTrustedOrigins = new Set<string>();
  for (const value of [
    authBaseUrl,
    normalizeOrigin(env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST),
    normalizeOrigin(env.NEXT_PUBLIC_APP_URL),
    normalizeOrigin(env.RAILWAY_PUBLIC_DOMAIN),
    normalizeOrigin(env.VERCEL_URL),
    ...splitTrustedOrigins(env.BETTER_AUTH_TRUSTED_ORIGINS),
  ]) {
    if (value) {
      authTrustedOrigins.add(value);
    }
  }

  const backendPublicUrl =
    normalizePublicUrl(env.NEXT_PUBLIC_AIR_JAM_SERVER_URL) ?? platformPublicUrl;

  return {
    platformPublicUrl,
    platformPublicOrigin,
    hasExplicitPlatformPublicOrigin: Boolean(explicitPublicUrl),
    backendPublicUrl,
    authBaseUrl,
    authTrustedOrigins: [...authTrustedOrigins],
    githubAuthEnabled: resolveBooleanEnv(
      env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED,
      Boolean(
        trimToUndefined(env.GITHUB_CLIENT_ID) &&
          trimToUndefined(env.GITHUB_CLIENT_SECRET),
      ),
    ),
    appId: trimToUndefined(env.NEXT_PUBLIC_AIR_JAM_APP_ID),
    systemHostGrantEndpoint:
      trimToUndefined(env.NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT) ??
      (env.NODE_ENV === "production" ? "/api/airjam/host-grant" : undefined),
  };
};
