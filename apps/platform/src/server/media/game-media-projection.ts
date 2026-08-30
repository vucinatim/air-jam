import { gameMediaAssets } from "@/db/schema";
import {
  getActiveGameMediaAssetId,
  type GameMediaActiveProjection,
} from "./game-media-assignments";
import { buildManagedGameMediaUrl } from "./game-media-public-url";

export const projectGameMediaAsset = ({
  asset,
  active,
}: {
  asset: typeof gameMediaAssets.$inferSelect;
  active: GameMediaActiveProjection;
}) => {
  const activeAssetId = getActiveGameMediaAssetId(active, asset.kind);

  return {
    ...asset,
    activeAssetId,
    isActive: activeAssetId === asset.id,
    publicUrl: buildManagedGameMediaUrl({
      gameId: asset.gameId,
      assetId: asset.status === "ready" ? asset.id : null,
      kind: asset.kind,
    }),
  };
};
