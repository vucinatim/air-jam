export const normalizePlatformRequestHost = (
  rawHost: string | null | undefined,
): string | null => {
  const candidate = rawHost?.trim().toLowerCase();
  if (!candidate || candidate.includes(",") || /\s/.test(candidate)) {
    return null;
  }

  try {
    const parsed = new URL(`http://${candidate}`);
    return parsed.host === candidate ? parsed.host : null;
  } catch {
    return null;
  }
};
