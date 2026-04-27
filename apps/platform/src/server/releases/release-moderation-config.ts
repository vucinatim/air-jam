import { getSiteUrl } from "@/lib/site-url";
import {
  loadReleaseModerationAvailabilityProbeEnv,
  loadReleaseModerationEnv,
  resolveConfiguredReleasesBaseUrl,
} from "./release-env";

export type ReleaseModerationConfig = {
  internalAccessSecret: string;
  publicBaseUrl: string;
  browserLaunch: {
    wsEndpoint: string | null;
    executablePath: string | null;
    navigationTimeoutMs: number;
    waitAfterLoadMs: number;
    viewportWidth: number;
    viewportHeight: number;
  };
  imageModeration: {
    mode: "openai" | "disabled";
    openAi: {
      apiKey: string;
      model: string;
      baseUrl: string;
      timeoutMs: number;
    } | null;
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

  const probe = loadReleaseModerationAvailabilityProbeEnv();
  const wsEndpoint = probe.AIRJAM_RELEASES_BROWSER_WS_ENDPOINT ?? null;
  const executablePath = probe.AIRJAM_RELEASES_BROWSER_EXECUTABLE_PATH ?? null;
  const internalAccessSecret =
    probe.AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN ?? null;
  const imageModerationMode = probe.AIRJAM_RELEASES_IMAGE_MODERATION_MODE;
  const openAiApiKey = probe.OPENAI_API_KEY ?? null;

  if (!wsEndpoint && !executablePath) {
    cachedReleaseModerationAvailability = {
      available: false,
      reason:
        "Release screenshot moderation is not configured. Set AIRJAM_RELEASES_BROWSER_WS_ENDPOINT or AIRJAM_RELEASES_BROWSER_EXECUTABLE_PATH to enable it.",
    };
    return cachedReleaseModerationAvailability;
  }

  if (!internalAccessSecret) {
    cachedReleaseModerationAvailability = {
      available: false,
      reason:
        "Release screenshot moderation is not configured. Set AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN to enable scoped inspection access.",
    };
    return cachedReleaseModerationAvailability;
  }

  if (imageModerationMode === "openai" && !openAiApiKey) {
    cachedReleaseModerationAvailability = {
      available: false,
      reason:
        "Release image moderation is not configured. Set OPENAI_API_KEY or set AIRJAM_RELEASES_IMAGE_MODERATION_MODE=disabled for local capture-only releases.",
    };
    return cachedReleaseModerationAvailability;
  }

  const parsed = loadReleaseModerationEnv();
  cachedReleaseModerationConfig = {
    internalAccessSecret: parsed.internalAccessSecret,
    publicBaseUrl: (resolveConfiguredReleasesBaseUrl() || getSiteUrl()).replace(
      /\/$/,
      "",
    ),
    browserLaunch: parsed.browserLaunch,
    imageModeration: parsed.imageModeration,
  };

  cachedReleaseModerationAvailability = {
    available: true,
    config: cachedReleaseModerationConfig,
  };

  return cachedReleaseModerationAvailability;
};

export const resetReleaseModerationConfigForTests = (): void => {
  cachedReleaseModerationConfig = null;
  cachedReleaseModerationAvailability = null;
};
