import type { GameMediaKind } from "@/lib/games/game-media-contract";
import { buildGameMediaUrl } from "@/lib/games/game-media-url";
import { resolvePlatformPublicUrl } from "@/lib/platform-public-url";

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
  const hasExplicitPublicOrigin = Boolean(
    process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST ||
      process.env.VERCEL_URL,
  );

  if (!hasExplicitPublicOrigin) {
    return mediaPath;
  }

  return new URL(
    mediaPath,
    resolvePlatformPublicUrl(),
  ).toString();
};
