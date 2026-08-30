const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

export const buildReleaseGenerationStorageKeys = ({
  gameId,
  releaseId,
  generationId,
}: {
  gameId: string;
  releaseId: string;
  generationId: string;
}) => {
  const generationRoot = trimSlashes(
    `games/${gameId}/releases/${releaseId}/generations/${generationId}`,
  );

  return {
    generationRootKey: generationRoot,
    zipObjectKey: `${generationRoot}/source/artifact.zip`,
  };
};

export const buildReleaseGenerationSiteRootKey = ({
  gameId,
  releaseId,
  generationId,
  outputId,
}: {
  gameId: string;
  releaseId: string;
  generationId: string;
  outputId: string;
}): string =>
  `${buildReleaseGenerationStorageKeys({ gameId, releaseId, generationId }).generationRootKey}/outputs/${trimSlashes(outputId)}/site`;

export const buildReleaseSiteObjectKey = (
  siteRootKey: string,
  relativePath: string,
): string => `${trimSlashes(siteRootKey)}/${trimSlashes(relativePath)}`;

export const buildReleaseGenerationScreenshotObjectKey = ({
  gameId,
  releaseId,
  generationId,
  captureId,
}: {
  gameId: string;
  releaseId: string;
  generationId: string;
  captureId: string;
}): string =>
  `${buildReleaseGenerationStorageKeys({ gameId, releaseId, generationId }).generationRootKey}/screenshots/${trimSlashes(captureId)}.png`;
