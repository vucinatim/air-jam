import type { ArcadeGame } from "@/components/arcade";

const LOCAL_REFERENCE_PONG_SLUG = "local-pong";
const LOCAL_REFERENCE_PONG_ID = "local-reference-pong";

const getLocalReferencePongUrl = (): string | null => {
  const explicitUrl = process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return "http://127.0.0.1:5173";
};

export const getLocalReferenceArcadeGame = (
  slugOrId: string | null | undefined,
): ArcadeGame | null => {
  if (!slugOrId || slugOrId !== LOCAL_REFERENCE_PONG_SLUG) {
    return null;
  }

  const url = getLocalReferencePongUrl();
  if (!url) {
    return null;
  }

  return {
    id: LOCAL_REFERENCE_PONG_ID,
    slug: LOCAL_REFERENCE_PONG_SLUG,
    name: "Pong",
    ownerName: "Air Jam Local",
    url,
    thumbnailUrl: null,
    videoUrl: null,
  };
};
