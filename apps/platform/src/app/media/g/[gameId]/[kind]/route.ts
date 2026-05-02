import { parseGameMediaKindPath } from "@/lib/games/game-media-policy";
import { getGameMediaAssetForKind } from "@/server/media/game-media-service";
import { getGameMediaStorage } from "@/server/media/game-media-storage";

export const dynamic = "force-dynamic";

const MEDIA_CACHE_CONTROL = "public, max-age=300, s-maxage=3600";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{
      gameId: string;
      kind: string;
    }>;
  },
) {
  const { gameId, kind } = await context.params;
  const parsedKind = parseGameMediaKindPath(kind);

  if (!parsedKind) {
    return new Response("Not found", { status: 404 });
  }

  const asset = await getGameMediaAssetForKind({
    gameId,
    kind: parsedKind,
  });

  if (!asset) {
    return new Response("Not found", { status: 404 });
  }

  const storage = getGameMediaStorage();
  const objectHead = await storage.headObject(asset.storageKey);
  if (!objectHead) {
    return new Response("Not found", { status: 404 });
  }

  const body = await storage.readObject(asset.storageKey);

  return new Response(new Uint8Array(body), {
    status: 200,
    headers: {
      "content-type": objectHead.contentType || asset.mimeType,
      "cache-control": MEDIA_CACHE_CONTROL,
    },
  });
}
