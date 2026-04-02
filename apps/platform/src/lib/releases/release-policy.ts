import type { GameReleaseStatus } from "./release-contract";

export const RELEASE_UPLOAD_CONTENT_TYPE = "application/zip";
export const RELEASE_UPLOAD_FILENAME_EXTENSION = ".zip";

export const MAX_RELEASE_ZIP_BYTES = 100 * 1024 * 1024;
export const MAX_RELEASE_EXTRACTED_BYTES = 250 * 1024 * 1024;
export const MAX_RELEASE_FILE_COUNT = 5_000;
export const MAX_RELEASE_FILE_BYTES = 25 * 1024 * 1024;

export const allowedReleaseStatusTransitions: Record<
  GameReleaseStatus,
  readonly GameReleaseStatus[]
> = {
  draft: ["uploading", "archived"],
  uploading: ["checking", "failed", "archived"],
  checking: ["ready", "failed", "quarantined", "archived"],
  ready: ["quarantined", "archived"],
  live: ["quarantined", "archived"],
  failed: ["archived"],
  quarantined: ["archived"],
  archived: [],
} as const;

export const canTransitionReleaseStatus = (
  currentStatus: GameReleaseStatus,
  nextStatus: GameReleaseStatus,
): boolean => allowedReleaseStatusTransitions[currentStatus].includes(nextStatus);
