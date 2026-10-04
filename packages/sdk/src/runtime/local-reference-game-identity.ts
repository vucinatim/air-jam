const LOCAL_REFERENCE_GAME_PREFIX = "local-reference-";

/** Namespaces a local workspace game in the development Arcade catalog. */
export const localReferenceGameId = (sourceGameId: string): string =>
  `${LOCAL_REFERENCE_GAME_PREFIX}${sourceGameId}`;

/** Returns the workspace game ID only for a local-reference catalog identity. */
export const localReferenceSourceGameId = (
  runtimeGameId: string,
): string | null =>
  runtimeGameId.startsWith(LOCAL_REFERENCE_GAME_PREFIX)
    ? runtimeGameId.slice(LOCAL_REFERENCE_GAME_PREFIX.length) || null
    : null;
