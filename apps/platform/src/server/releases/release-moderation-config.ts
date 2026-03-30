import { getSiteUrl } from "@/lib/site-url";

export type ReleaseModerationConfig = {
  internalAccessToken: string;
  publicBaseUrl: string;
  browserLaunch: {
    wsEndpoint: string | null;
    executablePath: string | null;
    navigationTimeoutMs: number;
    waitAfterLoadMs: number;
    viewportWidth: number;
    viewportHeight: number;
  };
  openAi: {
    apiKey: string;
    model: string;
    baseUrl: string;
    timeoutMs: number;
  };
};

let cachedReleaseModerationConfig: ReleaseModerationConfig | null = null;
let cachedReleaseModerationAvailability:
  | {
      available: true;
      config: ReleaseModerationConfig;
    }
  | {
      available: false;
      reason: string;
    }
  | null = null;

const readPositiveIntegerEnv = (name: string, fallback: number): number => {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`Invalid positive integer env for ${name}: ${rawValue}`);
  }

  return parsedValue;
};

export const getReleaseModerationConfig = (): ReleaseModerationConfig => {
  const availability = getReleaseModerationAvailability();
  if (!availability.available) {
    throw new Error(availability.reason);
  }

  return availability.config;
};

export const getReleaseModerationAvailability = () => {
  if (cachedReleaseModerationAvailability) {
    return cachedReleaseModerationAvailability;
  }

  const wsEndpoint =
    process.env.AIRJAM_RELEASES_BROWSER_WS_ENDPOINT?.trim() || null;
  const executablePath =
    process.env.AIRJAM_RELEASES_BROWSER_EXECUTABLE_PATH?.trim() || null;
  const internalAccessToken =
    process.env.AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN?.trim() || null;
  const openAiApiKey = process.env.OPENAI_API_KEY?.trim() || null;

  if (!wsEndpoint && !executablePath) {
    cachedReleaseModerationAvailability = {
      available: false,
      reason:
        "Release screenshot moderation is not configured. Set AIRJAM_RELEASES_BROWSER_WS_ENDPOINT or AIRJAM_RELEASES_BROWSER_EXECUTABLE_PATH to enable it.",
    };
    return cachedReleaseModerationAvailability;
  }

  if (!internalAccessToken) {
    cachedReleaseModerationAvailability = {
      available: false,
      reason:
        "Release screenshot moderation is not configured. Set AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN to enable it.",
    };
    return cachedReleaseModerationAvailability;
  }

  if (!openAiApiKey) {
    cachedReleaseModerationAvailability = {
      available: false,
      reason:
        "Release screenshot moderation is not configured. Set OPENAI_API_KEY to enable it.",
    };
    return cachedReleaseModerationAvailability;
  }

  cachedReleaseModerationConfig = {
    internalAccessToken,
    publicBaseUrl: (
      process.env.NEXT_PUBLIC_RELEASES_BASE_URL?.trim() ||
      process.env.AIRJAM_RELEASES_BASE_URL?.trim() ||
      getSiteUrl()
    ).replace(/\/$/, ""),
    browserLaunch: {
      wsEndpoint,
      executablePath,
      navigationTimeoutMs: readPositiveIntegerEnv(
        "AIRJAM_RELEASES_BROWSER_NAVIGATION_TIMEOUT_MS",
        20_000,
      ),
      waitAfterLoadMs: readPositiveIntegerEnv(
        "AIRJAM_RELEASES_BROWSER_WAIT_AFTER_LOAD_MS",
        1_000,
      ),
      viewportWidth: readPositiveIntegerEnv(
        "AIRJAM_RELEASES_BROWSER_VIEWPORT_WIDTH",
        1440,
      ),
      viewportHeight: readPositiveIntegerEnv(
        "AIRJAM_RELEASES_BROWSER_VIEWPORT_HEIGHT",
        900,
      ),
    },
    openAi: {
      apiKey: openAiApiKey,
      model:
        process.env.AIRJAM_RELEASES_OPENAI_MODERATION_MODEL?.trim() ||
        "omni-moderation-latest",
      baseUrl:
        process.env.AIRJAM_RELEASES_OPENAI_BASE_URL?.trim() ||
        "https://api.openai.com/v1",
      timeoutMs: readPositiveIntegerEnv(
        "AIRJAM_RELEASES_OPENAI_TIMEOUT_MS",
        20_000,
      ),
    },
  };

  cachedReleaseModerationAvailability = {
    available: true,
    config: cachedReleaseModerationConfig,
  };

  return cachedReleaseModerationAvailability;
};
