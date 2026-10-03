import type { ArcadeGame } from "@/components/arcade";
import { airJamGithubRepoUrl } from "@/lib/social-links";
import { localReferenceGameId } from "@air-jam/sdk/arcade/surface";
import { buildArcadeControllerRuntimeUrl } from "@air-jam/sdk/arcade/url";

type LocalReferenceGameKey =
  | "air-capture"
  | "pong"
  | "minimal"
  | "code-review"
  | "last-band-standing"
  | "the-office";

type LocalReferenceGameConfig = {
  key: LocalReferenceGameKey;
  slug: string;
  name: string;
  defaultDevUrl?: string;
  sourcePath: string;
  templateId: string;
};

type LocalReferenceGameOptions = {
  env?: Partial<NodeJS.ProcessEnv>;
  nodeEnv?: string | undefined;
};

const CLIENT_LOCAL_REFERENCE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_AIR_CAPTURE_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_AIR_CAPTURE_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_AIR_CAPTURE_CONTROLLER_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_AIR_CAPTURE_CONTROLLER_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_CONTROLLER_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_CONTROLLER_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_MINIMAL_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_MINIMAL_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_MINIMAL_CONTROLLER_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_MINIMAL_CONTROLLER_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_CODE_REVIEW_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_CODE_REVIEW_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_CODE_REVIEW_CONTROLLER_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_CODE_REVIEW_CONTROLLER_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_LAST_BAND_STANDING_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_LAST_BAND_STANDING_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_LAST_BAND_STANDING_CONTROLLER_URL:
    process.env
      .NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_LAST_BAND_STANDING_CONTROLLER_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_THE_OFFICE_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_THE_OFFICE_URL,
  NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_THE_OFFICE_CONTROLLER_URL:
    process.env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_THE_OFFICE_CONTROLLER_URL,
};

const DEFAULT_LOCAL_REFERENCE_GAME: LocalReferenceGameKey = "air-capture";

const LOCAL_REFERENCE_GAMES: readonly LocalReferenceGameConfig[] = [
  {
    key: "air-capture",
    slug: "local-air-capture",
    name: "Air Capture",
    defaultDevUrl: "http://127.0.0.1:5173",
    sourcePath: "games/air-capture",
    templateId: "air-capture",
  },
  {
    key: "pong",
    slug: "local-pong",
    name: "Pong",
    defaultDevUrl: "http://127.0.0.1:5173",
    sourcePath: "games/pong",
    templateId: "pong",
  },
  {
    key: "minimal",
    slug: "local-minimal",
    name: "Minimal",
    defaultDevUrl: "http://127.0.0.1:5173",
    sourcePath: "games/minimal",
    templateId: "minimal",
  },
  {
    key: "code-review",
    slug: "local-code-review",
    name: "Code Review",
    sourcePath: "games/code-review",
    templateId: "code-review",
  },
  {
    key: "last-band-standing",
    slug: "local-last-band-standing",
    name: "Last Band Standing",
    sourcePath: "games/last-band-standing",
    templateId: "last-band-standing",
  },
  {
    key: "the-office",
    slug: "local-the-office",
    name: "The Office",
    sourcePath: "games/the-office",
    templateId: "the-office",
  },
] as const;

const LOCAL_REFERENCE_OWNER_NAME = "Air Jam Local";
const LOCAL_REFERENCE_BADGE_LABEL = "Local Dev";

const normalizeLocalReferenceUrl = (
  value: string | undefined,
): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const readConfiguredLocalReferenceUrl = (
  gameKey: LocalReferenceGameKey,
  env: Partial<NodeJS.ProcessEnv>,
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
    case "minimal":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_MINIMAL_URL,
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

const readConfiguredLocalReferenceControllerUrl = (
  gameKey: LocalReferenceGameKey,
  env: Partial<NodeJS.ProcessEnv>,
): string | null => {
  switch (gameKey) {
    case "air-capture":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_AIR_CAPTURE_CONTROLLER_URL,
      );
    case "pong":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_PONG_CONTROLLER_URL,
      );
    case "code-review":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_CODE_REVIEW_CONTROLLER_URL,
      );
    case "minimal":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_MINIMAL_CONTROLLER_URL,
      );
    case "last-band-standing":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_LAST_BAND_STANDING_CONTROLLER_URL,
      );
    case "the-office":
      return normalizeLocalReferenceUrl(
        env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_THE_OFFICE_CONTROLLER_URL,
      );
    default:
      return null;
  }
};

const resolveDefaultLocalReferenceKey = (
  env: Partial<NodeJS.ProcessEnv>,
): LocalReferenceGameKey => {
  const configuredValue =
    env.NEXT_PUBLIC_AIR_JAM_LOCAL_REFERENCE_DEFAULT?.trim().toLowerCase();

  return LOCAL_REFERENCE_GAMES.some((game) => game.key === configuredValue)
    ? (configuredValue as LocalReferenceGameKey)
    : DEFAULT_LOCAL_REFERENCE_GAME;
};

const findLocalReferenceGameConfig = (
  slugOrId: string,
): LocalReferenceGameConfig | null =>
  LOCAL_REFERENCE_GAMES.find(
    (config) =>
      config.slug === slugOrId || localReferenceGameId(config.key) === slugOrId,
  ) ?? null;

const resolveLocalReferenceGameUrl = (
  config: LocalReferenceGameConfig,
  env: Partial<NodeJS.ProcessEnv>,
  defaultGameKey: LocalReferenceGameKey,
  options: { allowDirectFallback?: boolean } = {},
): string | null => {
  const explicitUrl = readConfiguredLocalReferenceUrl(config.key, env);
  if (explicitUrl) {
    return explicitUrl;
  }

  const canUseFallbackUrl =
    typeof config.defaultDevUrl === "string" &&
    (config.key === defaultGameKey || options.allowDirectFallback === true);

  return canUseFallbackUrl ? (config.defaultDevUrl ?? null) : null;
};

const toLocalReferenceArcadeGame = (
  config: LocalReferenceGameConfig,
  url: string,
  env: Partial<NodeJS.ProcessEnv>,
): ArcadeGame => {
  const controllerUrl =
    readConfiguredLocalReferenceControllerUrl(config.key, env) ??
    buildArcadeControllerRuntimeUrl(url);
  if (!controllerUrl) {
    throw new Error(
      `Unable to derive local reference controller URL for ${config.key}.`,
    );
  }

  return {
    id: localReferenceGameId(config.key),
    slug: config.slug,
    name: config.name,
    ownerName: LOCAL_REFERENCE_OWNER_NAME,
    url,
    controllerUrl,
    thumbnailUrl: null,
    videoUrl: null,
    catalogSource: "local_dev",
    catalogBadgeLabel: LOCAL_REFERENCE_BADGE_LABEL,
    sourceUrl: `${airJamGithubRepoUrl}/tree/main/${config.sourcePath}`,
    templateId: config.templateId,
  };
};

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
    const resolvedUrl = resolveLocalReferenceGameUrl(
      config,
      env,
      defaultGameKey,
    );

    return resolvedUrl
      ? [toLocalReferenceArcadeGame(config, resolvedUrl, env)]
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

  const env = options.env ?? CLIENT_LOCAL_REFERENCE_ENV;
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;

  if (nodeEnv === "production") {
    return null;
  }

  const config = findLocalReferenceGameConfig(slugOrId);
  if (!config) {
    return null;
  }

  const defaultGameKey = resolveDefaultLocalReferenceKey(env);
  const resolvedUrl = resolveLocalReferenceGameUrl(
    config,
    env,
    defaultGameKey,
    {
      allowDirectFallback: true,
    },
  );
  if (!resolvedUrl) {
    return null;
  }

  return toLocalReferenceArcadeGame(config, resolvedUrl, env);
};
