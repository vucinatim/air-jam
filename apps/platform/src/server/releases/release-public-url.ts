import { buildHostedReleaseAssetPath } from "@/lib/releases/release-url";
import { requireHostedReleasePublicOrigin } from "@/lib/releases/hosted-release-origin";

export const getHostedReleasesBaseUrl = (): string =>
  requireHostedReleasePublicOrigin();

export const buildHostedReleaseAssetUrl = ({
  gameId,
  releaseId,
  generationId,
  assetPath,
}: {
  gameId: string;
  releaseId: string;
  generationId: string;
  assetPath: string;
}): string =>
  `${getHostedReleasesBaseUrl()}${buildHostedReleaseAssetPath({
    gameId,
    releaseId,
    generationId,
    assetPath,
  })}`;
