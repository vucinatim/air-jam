import type { ArcadeGame } from "@/components/arcade";

type ArcadeGameSource = {
  id: string;
  name: string;
  url: string;
  controllerUrl: string;
  ownerName?: string | null;
  thumbnailUrl?: string | null;
  videoUrl?: string | null;
  slug?: string | null;
  catalogSource?: "public_arcade" | "local_dev";
  catalogBadgeLabel?: string | null;
  sourceUrl?: string | null;
  templateId?: string | null;
};

export const toArcadeGame = (game: ArcadeGameSource): ArcadeGame => ({
  id: game.id,
  name: game.name,
  url: game.url,
  controllerUrl: game.controllerUrl,
  ownerName: game.ownerName,
  thumbnailUrl: game.thumbnailUrl,
  videoUrl: game.videoUrl,
  slug: game.slug,
  catalogSource: game.catalogSource ?? "public_arcade",
  catalogBadgeLabel: game.catalogBadgeLabel ?? null,
  sourceUrl: game.sourceUrl ?? null,
  templateId: game.templateId ?? null,
});

export const toArcadeGames = (
  games: ArcadeGameSource[] | null | undefined,
): ArcadeGame[] => (games ?? []).map(toArcadeGame);
