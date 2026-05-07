import type { GameMediaKind } from "@/lib/games/game-media-contract";
import { buildGameMediaUrl } from "@/lib/games/game-media-url";
import { resolvePlatformDeploymentConfig } from "@/lib/platform-deployment-config";

export const buildManagedGameMediaUrl = ({
  gameId,
  assetId,
  kind,
}: {
  gameId: string;
  assetId: string | null | undefined;
  kind: GameMediaKind;
}): string | null => {
  if (!assetId) {
    return null;
  }

  const mediaPath = buildGameMediaUrl({
    gameId,
    kind,
  });
  const deploymentConfig = resolvePlatformDeploymentConfig(process.env);

  if (!deploymentConfig.hasExplicitPlatformPublicOrigin) {
    return mediaPath;
  }

  return new URL(mediaPath, deploymentConfig.platformPublicUrl).toString();
};
