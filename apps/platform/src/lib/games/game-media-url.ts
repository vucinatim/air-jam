import type { GameMediaKind } from "./game-media-contract";
import { normalizeGameMediaKindPath } from "./game-media-policy";

export const buildGameMediaUrl = ({
  gameId,
  kind,
}: {
  gameId: string;
  kind: GameMediaKind;
}): string => `/media/g/${gameId}/${normalizeGameMediaKindPath(kind)}`;
