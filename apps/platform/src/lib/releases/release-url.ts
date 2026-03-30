export const RELEASES_PATH_PREFIX = "/releases";

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

export const buildHostedReleaseAssetPath = ({
  gameId,
  releaseId,
  assetPath,
}: {
  gameId: string;
  releaseId: string;
  assetPath: string;
}): string =>
  `${RELEASES_PATH_PREFIX}/g/${trimSlashes(gameId)}/r/${trimSlashes(
    releaseId,
  )}/${trimSlashes(assetPath)}`;

export const normalizeRequestedReleaseAssetPath = (
  assetPathSegments: string[] | undefined,
  fallbackAssetPath: string,
): string => {
  const joinedPath = assetPathSegments?.join("/").trim() || fallbackAssetPath;
  const normalizedPath = joinedPath
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .replace(/\/+/g, "/");

  if (
    !normalizedPath ||
    normalizedPath === "." ||
    normalizedPath.includes("\0") ||
    normalizedPath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("Invalid release asset path.");
  }

  return normalizedPath;
};
