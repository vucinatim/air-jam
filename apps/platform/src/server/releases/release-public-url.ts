import { buildHostedReleaseAssetPath } from "@/lib/releases/release-url";
import { getSiteUrl } from "@/lib/site-url";
import { resolveConfiguredReleasesBaseUrl } from "./release-env";

const normalizePublicBaseUrl = (rawUrl: string): string =>
  rawUrl.trim().replace(/\/$/, "");

export const getHostedReleasesBaseUrl = (): string => {
  const configuredBaseUrl = resolveConfiguredReleasesBaseUrl();

  return normalizePublicBaseUrl(configuredBaseUrl || getSiteUrl());
};

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
