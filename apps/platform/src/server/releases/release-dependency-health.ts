import { getReleaseModerationAvailability } from "./release-moderation-config";
import { getReleaseStorageConfig } from "./release-storage-config";

export type ReleaseDependencyHealthBoundary = {
  required: boolean;
  status: "ready" | "unavailable";
  reason: string | null;
};

export const assessReleaseDependencyHealth = ({
  required,
}: {
  required: boolean;
}): {
  releaseStorage: ReleaseDependencyHealthBoundary;
  releaseModeration: ReleaseDependencyHealthBoundary;
} => {
  let releaseStorage: ReleaseDependencyHealthBoundary;
  try {
    getReleaseStorageConfig();
    releaseStorage = { required, status: "ready", reason: null };
  } catch {
    releaseStorage = {
      required,
      status: "unavailable",
      reason: "Release artifact storage is not configured or invalid.",
    };
  }

  let releaseModeration: ReleaseDependencyHealthBoundary;
  try {
    const availability = getReleaseModerationAvailability();
    releaseModeration = availability.available
      ? { required, status: "ready", reason: null }
      : {
          required,
          status: "unavailable",
          reason:
            "Release screenshot and moderation processing is unavailable.",
        };
  } catch {
    releaseModeration = {
      required,
      status: "unavailable",
      reason: "Release screenshot and moderation configuration is invalid.",
    };
  }

  return { releaseStorage, releaseModeration };
};
