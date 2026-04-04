export const DEFAULT_POST_AUTH_PATH = "/dashboard/games";

export function normalizePostAuthPath(rawPath?: string | null): string {
  if (!rawPath) {
    return DEFAULT_POST_AUTH_PATH;
  }

  if (!rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return DEFAULT_POST_AUTH_PATH;
  }

  return rawPath;
}

export function createLoginHref(nextPath?: string | null): string {
  const normalizedPath = normalizePostAuthPath(nextPath);
  return `/login?next=${encodeURIComponent(normalizedPath)}`;
}

