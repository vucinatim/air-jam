import { assessHostedReleaseOrigin } from "@/lib/releases/hosted-release-origin";
import {
  loadReleaseModerationAvailabilityProbeEnv,
  loadReleaseModerationEnv,
  type ReleaseModerationEnvConfig,
} from "./release-env";

export type ReleaseModerationConfig = ReleaseModerationEnvConfig & {
  publicBaseUrl: string;
};

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
  const accountId = probe.AIRJAM_RELEASES_BROWSER_ACCOUNT_ID;
  const browserApiToken = probe.AIRJAM_RELEASES_BROWSER_API_TOKEN;
  const internalAccessSecret =
    probe.AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN ?? null;
  const imageModerationMode = probe.AIRJAM_RELEASES_IMAGE_MODERATION_MODE;
  const openAiApiKey = probe.OPENAI_API_KEY ?? null;

  if (!accountId) {
    cachedReleaseModerationAvailability = {
      available: false,
      reason:
        "Release screenshot moderation is not configured. Set AIRJAM_RELEASES_BROWSER_ACCOUNT_ID to use Cloudflare Browser Run.",
    };
    return cachedReleaseModerationAvailability;
  }

  if (!browserApiToken) {
    cachedReleaseModerationAvailability = {
      available: false,
      reason:
        "Release screenshot moderation is not configured. Set AIRJAM_RELEASES_BROWSER_API_TOKEN to authenticate with Cloudflare Browser Run.",
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

  const releaseOrigin = assessHostedReleaseOrigin();
  if (releaseOrigin.status !== "ready") {
    cachedReleaseModerationAvailability = {
      available: false,
      reason: releaseOrigin.reason,
    };
    return cachedReleaseModerationAvailability;
  }

  const parsed = loadReleaseModerationEnv();
  cachedReleaseModerationAvailability = {
    available: true,
    config: { ...parsed, publicBaseUrl: releaseOrigin.publicOrigin },
  };

  return cachedReleaseModerationAvailability;
};

export const resetReleaseModerationConfigForTests = (): void => {
  cachedReleaseModerationAvailability = null;
};
