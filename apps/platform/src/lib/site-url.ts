const LOCAL_FALLBACK = "http://localhost:3000";

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return LOCAL_FALLBACK;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export function getSiteUrl(): string {
  const rawUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || LOCAL_FALLBACK;

  try {
    return new URL(normalizeUrl(rawUrl)).toString().replace(/\/$/, "");
  } catch {
    return LOCAL_FALLBACK;
  }
}
