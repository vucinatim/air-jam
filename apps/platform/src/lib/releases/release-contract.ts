import { z } from "zod";

export const gameReleaseSourceKindValues = ["upload"] as const;
export type GameReleaseSourceKind = (typeof gameReleaseSourceKindValues)[number];
export const gameReleaseSourceKindSchema = z.enum(gameReleaseSourceKindValues);

export const gameReleaseStatusValues = [
  "draft",
  "uploading",
  "checking",
  "ready",
  "live",
  "failed",
  "quarantined",
  "archived",
] as const;
export type GameReleaseStatus = (typeof gameReleaseStatusValues)[number];
export const gameReleaseStatusSchema = z.enum(gameReleaseStatusValues);

export const releaseCheckKindValues = [
  "artifact_validation",
  "screenshot_capture",
  "image_moderation",
] as const;
export type ReleaseCheckKind = (typeof releaseCheckKindValues)[number];
export const releaseCheckKindSchema = z.enum(releaseCheckKindValues);

export const releaseCheckStatusValues = [
  "pending",
  "passed",
  "failed",
  "warning",
] as const;
export type ReleaseCheckStatus = (typeof releaseCheckStatusValues)[number];
export const releaseCheckStatusSchema = z.enum(releaseCheckStatusValues);

export const releaseReportStatusValues = [
  "open",
  "reviewed",
  "dismissed",
] as const;
export type ReleaseReportStatus =
  (typeof releaseReportStatusValues)[number];
export const releaseReportStatusSchema = z.enum(releaseReportStatusValues);

export const releaseReportSourceValues = [
  "play_page",
  "arcade",
] as const;
export type ReleaseReportSource =
  (typeof releaseReportSourceValues)[number];
export const releaseReportSourceSchema = z.enum(releaseReportSourceValues);
