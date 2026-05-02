import type { GameMediaKind } from "@/lib/games/game-media-contract";
import path from "node:path";

const trimSlashes = (value: string): string => value.replace(/^\/+|\/+$/g, "");

const sanitizeFileExtension = (filename: string): string => {
  const extension = path.extname(filename.trim()).toLowerCase();
  if (!extension) {
    return "";
  }

  return extension.replace(/[^a-z0-9.]/g, "");
};

export const buildGameMediaStorageKeys = ({
  gameId,
  kind,
  assetId,
  originalFilename,
}: {
  gameId: string;
  kind: GameMediaKind;
  assetId: string;
  originalFilename: string;
}) => {
  const assetRootKey = trimSlashes(`games/${gameId}/media/${kind}/${assetId}`);
  const extension = sanitizeFileExtension(originalFilename);

  return {
    assetRootKey,
    objectKey: `${assetRootKey}/source${extension}`,
  };
};
