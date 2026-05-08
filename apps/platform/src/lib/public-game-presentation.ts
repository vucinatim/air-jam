import {
  getCuratedPublicGameAttribution,
  type PublicGameAttribution,
  type PublicGameCreator,
} from "@/lib/public-game-creators";

const MINIMAL_TEMPLATE_SLUG = "minimal";

const FEATURED_PUBLIC_GAME_SLUGS = [
  "air-capture",
  "last-band-standing",
  "code-review",
  "the-office",
] as const;

interface PublicGamePresentationShape {
  name: string;
  slug?: string | null;
  ownerName?: string | null;
}

export const getPublicGameDisplayName = <T extends PublicGamePresentationShape>(
  game: T,
): string => {
  if (game.slug === MINIMAL_TEMPLATE_SLUG) {
    return "Minimal Template";
  }

  return game.name;
};

export const getPublicGameOwnerName = <T extends PublicGamePresentationShape>(
  game: T,
): string | null => {
  const attribution = getCuratedPublicGameAttribution(game.slug);
  if (attribution?.label) {
    return attribution.label;
  }

  return game.ownerName ?? null;
};

export const getPublicGameCreators = <T extends PublicGamePresentationShape>(
  game: T,
): readonly PublicGameCreator[] => {
  const attribution = getCuratedPublicGameAttribution(game.slug);
  if (attribution?.creators?.length) {
    return attribution.creators;
  }

  if (!game.ownerName?.trim()) {
    return [];
  }

  return [{ name: game.ownerName.trim() }];
};

export const getPublicGameAttribution = <
  T extends PublicGamePresentationShape,
>(
  game: T,
): PublicGameAttribution | null => {
  const creators = getPublicGameCreators(game);
  if (creators.length === 0) {
    return null;
  }

  return {
    label: getPublicGameOwnerName(game) ?? undefined,
    creators,
  };
};

export const selectFeaturedPublicGames = <
  T extends PublicGamePresentationShape,
>(
  games: readonly T[],
): T[] => {
  const order = new Map<string, number>(
    FEATURED_PUBLIC_GAME_SLUGS.map((slug, index) => [slug, index]),
  );
  const featured = games
    .filter((game) => game.slug && order.has(game.slug))
    .sort((left, right) => {
      const leftRank = order.get(left.slug ?? "") ?? Number.MAX_SAFE_INTEGER;
      const rightRank = order.get(right.slug ?? "") ?? Number.MAX_SAFE_INTEGER;

      return leftRank - rightRank;
    });

  if (featured.length === FEATURED_PUBLIC_GAME_SLUGS.length) {
    return featured;
  }

  const featuredKeys = new Set(featured.map((game) => game.slug ?? game.name));
  const fallback = games.filter(
    (game) => !featuredKeys.has(game.slug ?? game.name),
  );

  return [...featured, ...fallback].slice(0, FEATURED_PUBLIC_GAME_SLUGS.length);
};
