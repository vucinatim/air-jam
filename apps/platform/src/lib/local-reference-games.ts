import type { ArcadeGame } from "@/components/arcade";

type LocalReferenceGameKey =
  | "air-capture"
  | "pong"
  | "code-review"
  | "last-band-standing"
  | "the-office";

type LocalReferenceGameConfig = {
  key: LocalReferenceGameKey;
  id: string;
  slug: string;
  name: string;
  defaultDevUrl?: string;
};

type LocalReferenceGameOptions = {
  env?: NodeJS.ProcessEnv;
  nodeEnv?: string | undefined;
};

const CLIENT_LOCAL_REFERENCE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_AIR_CAPTURE_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_AIR_CAPTURE_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_CODE_REVIEW_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_CODE_REVIEW_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_LAST_BAND_STANDING_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_LAST_BAND_STANDING_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_THE_OFFICE_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_THE_OFFICE_URL,
};

const DEFAULT_LOCAL_REFERENCE_GAME: LocalReferenceGameKey = "air-capture";

const LOCAL_REFERENCE_GAMES: readonly LocalReferenceGameConfig[] = [
  {
    key: "air-capture",
    id: "local-reference-air-capture",
    slug: "local-air-capture",
    name: "Air Capture",
    defaultDevUrl: "http://127.0.0.1:5173",
  },
  {
    key: "pong",
    id: "local-reference-pong",
    slug: "local-pong",
    name: "Pong",
    defaultDevUrl: "http://127.0.0.1:5173",
  },
  {
    key: "code-review",
    id: "local-reference-code-review",
    slug: "local-code-review",
    name: "Code Review",
  },
  {
    key: "last-band-standing",
    id: "local-reference-last-band-standing",
    slug: "local-last-band-standing",
    name: "Last Band Standing",
  },
  {
    key: "the-office",
    id: "local-reference-the-office",
    slug: "local-the-office",
    name: "The Office",
  },
] as const;

const LOCAL_REFERENCE_OWNER_NAME = "Air Jam Local";
const LOCAL_REFERENCE_BADGE_LABEL = "Local Dev";

const normalizeLocalReferenceUrl = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const readConfiguredLocalReferenceUrl = (
  gameKey: LocalReferenceGameKey,
  env: NodeJS.ProcessEnv,
): string | null => {
  switch (gameKey) {
    case "air-capture":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_AIR_CAPTURE_URL,
      );
    case "pong":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL,
      );
    case "code-review":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_CODE_REVIEW_URL,
      );
    case "last-band-standing":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_LAST_BAND_STANDING_URL,
      );
    case "the-office":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_THE_OFFICE_URL,
      );
    default:
      return null;
  }
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
  const env = options.env ?? CLIENT_LOCAL_REFERENCE_ENV;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;

  if (nodeEnv === "production") {
    return [];
  }

  const defaultGameKey = resolveDefaultLocalReferenceKey(env);

  return LOCAL_REFERENCE_GAMES.flatMap((config) => {
    const explicitUrl = readConfiguredLocalReferenceUrl(config.key, env);
    const fallbackUrl =
      explicitUrl === null &&
      config.key === defaultGameKey &&
      typeof config.defaultDevUrl === "string"
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
