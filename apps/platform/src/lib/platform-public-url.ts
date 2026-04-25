const LOCAL_FALLBACK = "http://localhost:3000";

const normalizeUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return LOCAL_FALLBACK;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

export const resolvePlatformPublicUrl = (
  env: NodeJS.ProcessEnv = process.env,
): string => {
  const rawUrl =
    env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST ||
    env.NEXT_PUBLIC_APP_URL ||
    env.VERCEL_URL ||
    LOCAL_FALLBACK;

  try {
    return new URL(normalizeUrl(rawUrl)).toString().replace(/\/$/, "");
  } catch {
    return LOCAL_FALLBACK;
  }
};

export { LOCAL_FALLBACK as PLATFORM_PUBLIC_URL_FALLBACK };
