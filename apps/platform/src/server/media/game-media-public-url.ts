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

  return new URL(
    buildGameMediaUrl({
      gameId,
      kind,
    }),
    resolvePlatformPublicUrl(),
  ).toString();
};
