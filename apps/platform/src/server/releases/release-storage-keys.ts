const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

export const buildReleaseStorageKeys = ({
  gameId,
  releaseId,
}: {
  gameId: string;
  releaseId: string;
}) => {
  const releaseRoot = trimSlashes(`games/${gameId}/releases/${releaseId}`);

  return {
    releaseRootKey: releaseRoot,
    zipObjectKey: `${releaseRoot}/artifact.zip`,
    siteRootKey: `${releaseRoot}/site`,
  };
};

export const buildReleaseSiteObjectKey = (
  siteRootKey: string,
  relativePath: string,
): string => `${trimSlashes(siteRootKey)}/${trimSlashes(relativePath)}`;

export const buildReleaseScreenshotObjectKey = ({
  gameId,
  releaseId,
}: {
  gameId: string;
  releaseId: string;
}): string =>
  `${trimSlashes(`games/${gameId}/releases/${releaseId}`)}/screenshots/moderation-primary.png`;
