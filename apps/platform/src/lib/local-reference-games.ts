import type { ArcadeGame } from "@/components/arcade";

type LocalReferenceGameKey = "air-capture" | "pong";

type LocalReferenceGameConfig = {
  key: LocalReferenceGameKey;
  id: string;
  slug: string;
  name: string;
  envVar: string;
  defaultDevUrl: string;
};

type LocalReferenceGameOptions = {
  env?: NodeJS.ProcessEnv;
  nodeEnv?: string | undefined;
};

const DEFAULT_LOCAL_REFERENCE_GAME: LocalReferenceGameKey = "air-capture";

const LOCAL_REFERENCE_GAMES: readonly LocalReferenceGameConfig[] = [
  {
    key: "air-capture",
    id: "local-reference-air-capture",
    slug: "local-air-capture",
    name: "Air Capture",
    envVar: "NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_AIR_CAPTURE_URL",
    defaultDevUrl: "http://127.0.0.1:5173",
  },
  {
    key: "pong",
    id: "local-reference-pong",
    slug: "local-pong",
    name: "Pong",
    envVar: "NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL",
    defaultDevUrl: "http://127.0.0.1:5173",
  },
] as const;

const LOCAL_REFERENCE_OWNER_NAME = "Air Jam Local";
const LOCAL_REFERENCE_BADGE_LABEL = "Local Dev";

const normalizeLocalReferenceUrl = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const resolveDefaultLocalReferenceKey = (
  env: NodeJS.ProcessEnv,
): LocalReferenceGameKey => {
  const configuredValue = env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT
    ?.trim()
    .toLowerCase();

  return LOCAL_REFERENCE_GAMES.some((game) => game.key === configuredValue)
    ? (configuredValue as LocalReferenceGameKey)
    : DEFAULT_LOCAL_REFERENCE_GAME;
};

const toLocalReferenceArcadeGame = (
  config: LocalReferenceGameConfig,
  url: string,
): ArcadeGame => ({
  id: config.id,
  slug: config.slug,
  name: config.name,
  ownerName: LOCAL_REFERENCE_OWNER_NAME,
  url,
  thumbnailUrl: null,
  videoUrl: null,
  catalogSource: "local_dev",
  catalogBadgeLabel: LOCAL_REFERENCE_BADGE_LABEL,
});

export const getLocalReferenceArcadeGames = (
  options: LocalReferenceGameOptions = {},
): ArcadeGame[] => {
  const env = options.env ?? process.env;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;

  if (nodeEnv === "production") {
    return [];
  }

  const defaultGameKey = resolveDefaultLocalReferenceKey(env);

  return LOCAL_REFERENCE_GAMES.flatMap((config) => {
    const explicitUrl = normalizeLocalReferenceUrl(env[config.envVar]);
    const fallbackUrl =
      explicitUrl === null && config.key === defaultGameKey
        ? config.defaultDevUrl
        : null;
    const resolvedUrl = explicitUrl ?? fallbackUrl;

    return resolvedUrl
      ? [toLocalReferenceArcadeGame(config, resolvedUrl)]
      : [];
  });
};

export const getLocalReferenceArcadeGame = (
  slugOrId: string | null | undefined,
  options: LocalReferenceGameOptions = {},
): ArcadeGame | null => {
  if (!slugOrId) {
    return null;
  }

  return (
    getLocalReferenceArcadeGames(options).find(
      (game) => game.slug === slugOrId || game.id === slugOrId,
    ) ?? null
  );
};
