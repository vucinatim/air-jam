import { z } from "zod";

export const gameMediaKindValues = [
  "thumbnail",
  "cover",
  "preview_video",
] as const;
export type GameMediaKind = (typeof gameMediaKindValues)[number];
export const gameMediaKindSchema = z.enum(gameMediaKindValues);

export const gameMediaStatusValues = [
  "draft",
  "uploading",
  "ready",
  "failed",
  "archived",
] as const;
export type GameMediaStatus = (typeof gameMediaStatusValues)[number];
export const gameMediaStatusSchema = z.enum(gameMediaStatusValues);
