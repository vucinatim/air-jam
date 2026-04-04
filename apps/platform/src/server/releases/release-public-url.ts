import { buildHostedReleaseAssetPath } from "@/lib/releases/release-url";
import { getSiteUrl } from "@/lib/site-url";

const normalizePublicBaseUrl = (rawUrl: string): string =>
  rawUrl.trim().replace(/\/$/, "");

export const getHostedReleasesBaseUrl = (): string => {
  const configuredBaseUrl =
    process.env.NEXT_PUBLIC_RELEASES_BASE_URL?.trim() ||
    process.env.AIRJAM_RELEASES_BASE_URL?.trim();

  return normalizePublicBaseUrl(configuredBaseUrl || getSiteUrl());
};

export const buildHostedReleaseAssetUrl = ({
  gameId,
  releaseId,
  assetPath,
}: {
  gameId: string;
  releaseId: string;
  assetPath: string;
}): string =>
  `${getHostedReleasesBaseUrl()}${buildHostedReleaseAssetPath({
    gameId,
    releaseId,
    assetPath,
  })}`;
