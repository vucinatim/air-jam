import type { ArcadeGame } from "@/components/arcade";

type ArcadeGameSource = {
  id: string;
  name: string;
  url: string;
  ownerName?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  slug?: string | null;
};

export const toArcadeGame = (game: ArcadeGameSource): ArcadeGame => ({
  id: game.id,
  name: game.name,
  url: game.url,
  ownerName: game.ownerName,
  thumbnailUrl: game.thumbnailUrl,
  videoUrl: game.videoUrl,
  slug: game.slug,
});

export const toArcadeGames = (
  games: ArcadeGameSource[] | null | undefined,
): ArcadeGame[] => (games ?? []).map(toArcadeGame);
