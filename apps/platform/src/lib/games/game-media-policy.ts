import type { GameMediaKind, GameMediaStatus } from "./game-media-contract";

export const GAME_MEDIA_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const GAME_MEDIA_VIDEO_CONTENT_TYPES = [
  "video/mp4",
  "video/webm",
] as const;

export const MAX_GAME_MEDIA_BYTES: Record<GameMediaKind, number> = {
  thumbnail: 5 * 1024 * 1024,
  cover: 10 * 1024 * 1024,
  preview_video: 50 * 1024 * 1024,
};

export const ALLOWED_GAME_MEDIA_CONTENT_TYPES: Record<
  GameMediaKind,
  readonly string[]
> = {
  thumbnail: GAME_MEDIA_IMAGE_CONTENT_TYPES,
  cover: GAME_MEDIA_IMAGE_CONTENT_TYPES,
  preview_video: GAME_MEDIA_VIDEO_CONTENT_TYPES,
};

export const ALLOWED_GAME_MEDIA_FILENAME_EXTENSIONS: Record<
  GameMediaKind,
  readonly string[]
> = {
  thumbnail: [".jpg", ".jpeg", ".png", ".webp"],
  cover: [".jpg", ".jpeg", ".png", ".webp"],
  preview_video: [".mp4", ".webm"],
};

export const allowedGameMediaStatusTransitions: Record<
  GameMediaStatus,
  readonly GameMediaStatus[]
> = {
  draft: ["uploading", "archived"],
  uploading: ["ready", "failed", "archived"],
  ready: ["archived"],
  failed: ["archived"],
  archived: [],
} as const;

export const canTransitionGameMediaStatus = (
  currentStatus: GameMediaStatus,
  nextStatus: GameMediaStatus,
): boolean =>
  allowedGameMediaStatusTransitions[currentStatus].includes(nextStatus);

export const normalizeGameMediaKindPath = (
  kind: GameMediaKind,
): "thumbnail" | "cover" | "preview-video" =>
  kind === "preview_video" ? "preview-video" : kind;

export const parseGameMediaKindPath = (value: string): GameMediaKind | null => {
  if (value === "thumbnail" || value === "cover") {
    return value;
  }
  if (value === "preview-video") {
    return "preview_video";
  }
  return null;
};
