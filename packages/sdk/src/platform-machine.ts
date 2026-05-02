import { z } from "zod";
import {
  gameReleaseSourceKindSchema,
  gameReleaseStatusSchema,
  releaseCheckKindSchema,
  releaseCheckStatusSchema,
  releaseReportSourceSchema,
  releaseReportStatusSchema,
} from "./release";

export const platformMachineErrorCodeValues = [
  "invalid_request",
  "authorization_pending",
  "expired_token",
  "access_denied",
  "invalid_token",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "validation_failed",
  "rate_limited",
] as const;

export const platformMachineErrorCodeSchema = z.enum(
  platformMachineErrorCodeValues,
);

export type PlatformMachineErrorCode = z.infer<
  typeof platformMachineErrorCodeSchema
>;

export const platformMachineApiErrorSchema = z.object({
  error: platformMachineErrorCodeSchema,
  message: z.string().min(1),
});

export type PlatformMachineApiError = z.infer<
  typeof platformMachineApiErrorSchema
>;

export const platformMachineDeviceGrantStatusValues = [
  "pending",
  "approved",
  "completed",
] as const;

export const platformMachineDeviceGrantStatusSchema = z.enum(
  platformMachineDeviceGrantStatusValues,
);

export type PlatformMachineDeviceGrantStatus = z.infer<
  typeof platformMachineDeviceGrantStatusSchema
>;

export const platformMachineUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["creator", "ops_admin"]),
});

export type PlatformMachineUser = z.infer<typeof platformMachineUserSchema>;

export const platformMachineSessionSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
  expiresAt: z.string().min(1),
  createdAt: z.string().min(1),
  userAgent: z.string().min(1),
});

export type PlatformMachineSession = z.infer<
  typeof platformMachineSessionSchema
>;

export const platformMachineDeviceStartInputSchema = z.object({
  clientName: z.string().trim().min(1).max(120).optional(),
});

export type PlatformMachineDeviceStartInput = z.infer<
  typeof platformMachineDeviceStartInputSchema
>;

export const platformMachineDeviceStartResultSchema = z.object({
  deviceCode: z.string().min(1),
  userCode: z.string().min(1),
  verificationUrl: z.string().url(),
  verificationUriComplete: z.string().url(),
  expiresAt: z.string().min(1),
  intervalSeconds: z.number().int().positive(),
});

export type PlatformMachineDeviceStartResult = z.infer<
  typeof platformMachineDeviceStartResultSchema
>;

export const platformMachineDevicePollInputSchema = z.object({
  deviceCode: z.string().trim().min(1),
});

export type PlatformMachineDevicePollInput = z.infer<
  typeof platformMachineDevicePollInputSchema
>;

export const platformMachineDevicePollResultSchema = z.object({
  platformBaseUrl: z.string().url(),
  user: platformMachineUserSchema,
  session: platformMachineSessionSchema,
});

export type PlatformMachineDevicePollResult = z.infer<
  typeof platformMachineDevicePollResultSchema
>;

export const platformMachineMeResultSchema = z.object({
  platformBaseUrl: z.string().url(),
  user: platformMachineUserSchema,
  session: platformMachineSessionSchema.omit({ token: true }),
});

export type PlatformMachineMeResult = z.infer<
  typeof platformMachineMeResultSchema
>;

export const platformMachineLogoutResultSchema = z.object({
  ok: z.literal(true),
});

export type PlatformMachineLogoutResult = z.infer<
  typeof platformMachineLogoutResultSchema
>;

export const platformMachineOwnedGameSummarySchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1).nullable(),
  name: z.string().min(1),
  sourceUrl: z.string().url().nullable(),
  templateId: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

export type PlatformMachineOwnedGameSummary = z.infer<
  typeof platformMachineOwnedGameSummarySchema
>;

export const platformMachineReleaseArtifactSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  originalFilename: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  extractedSizeBytes: z.number().int().nonnegative().nullable(),
  fileCount: z.number().int().nonnegative().nullable(),
  entryPath: z.string().min(1),
  contentHash: z.string().min(1).nullable(),
  createdAt: z.string().min(1),
});

export type PlatformMachineReleaseArtifact = z.infer<
  typeof platformMachineReleaseArtifactSchema
>;

export const platformMachineReleaseCheckSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  kind: releaseCheckKindSchema,
  status: releaseCheckStatusSchema,
  summary: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
});

export type PlatformMachineReleaseCheck = z.infer<
  typeof platformMachineReleaseCheckSchema
>;

export const platformMachineReleaseReportSchema = z.object({
  id: z.string().min(1),
  releaseId: z.string().min(1),
  status: releaseReportStatusSchema,
  source: releaseReportSourceSchema,
  reason: z.string().min(1),
  details: z.string().nullable(),
  reporterEmail: z.string().nullable(),
  createdAt: z.string().min(1),
  reviewedAt: z.string().nullable(),
});

export type PlatformMachineReleaseReport = z.infer<
  typeof platformMachineReleaseReportSchema
>;

export const platformMachineReleaseSummarySchema = z.object({
  id: z.string().min(1),
  gameId: z.string().min(1),
  sourceKind: gameReleaseSourceKindSchema,
  status: gameReleaseStatusSchema,
  versionLabel: z.string().nullable(),
  createdAt: z.string().min(1),
  uploadedAt: z.string().nullable(),
  checkedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  quarantinedAt: z.string().nullable(),
  archivedAt: z.string().nullable(),
  game: platformMachineOwnedGameSummarySchema,
  artifact: platformMachineReleaseArtifactSchema.nullable(),
  checks: z.array(platformMachineReleaseCheckSchema),
  reports: z.array(platformMachineReleaseReportSchema),
  hostUrl: z.string().url().nullable(),
  controllerUrl: z.string().url().nullable(),
});

export type PlatformMachineReleaseSummary = z.infer<
  typeof platformMachineReleaseSummarySchema
>;

export const platformMachineListOwnedGamesResultSchema = z.object({
  games: z.array(platformMachineOwnedGameSummarySchema),
});

export type PlatformMachineListOwnedGamesResult = z.infer<
  typeof platformMachineListOwnedGamesResultSchema
>;

export const platformMachineListReleasesResultSchema = z.object({
  game: platformMachineOwnedGameSummarySchema,
  releases: z.array(platformMachineReleaseSummarySchema),
});

export type PlatformMachineListReleasesResult = z.infer<
  typeof platformMachineListReleasesResultSchema
>;

export const platformMachineGetReleaseResultSchema = z.object({
  release: platformMachineReleaseSummarySchema,
});

export type PlatformMachineGetReleaseResult = z.infer<
  typeof platformMachineGetReleaseResultSchema
>;

export const platformMachineCreateReleaseDraftInputSchema = z.object({
  slugOrId: z.string().trim().min(1),
  versionLabel: z.string().trim().min(1).max(100).optional(),
});

export type PlatformMachineCreateReleaseDraftInput = z.infer<
  typeof platformMachineCreateReleaseDraftInputSchema
>;

export const platformMachineCreateReleaseDraftResultSchema = z.object({
  release: platformMachineReleaseSummarySchema,
});

export type PlatformMachineCreateReleaseDraftResult = z.infer<
  typeof platformMachineCreateReleaseDraftResultSchema
>;

export const platformMachineRequestReleaseUploadTargetInputSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

export type PlatformMachineRequestReleaseUploadTargetInput = z.infer<
  typeof platformMachineRequestReleaseUploadTargetInputSchema
>;

export const platformMachineReleaseUploadTargetSchema = z.object({
  key: z.string().min(1),
  method: z.literal("PUT"),
  url: z.string().url(),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string().min(1),
});

export type PlatformMachineReleaseUploadTarget = z.infer<
  typeof platformMachineReleaseUploadTargetSchema
>;

export const platformMachineRequestReleaseUploadTargetResultSchema = z.object({
  release: platformMachineReleaseSummarySchema,
  upload: platformMachineReleaseUploadTargetSchema,
});

export type PlatformMachineRequestReleaseUploadTargetResult = z.infer<
  typeof platformMachineRequestReleaseUploadTargetResultSchema
>;

export const platformMachineFinalizeReleaseUploadResultSchema = z.object({
  release: platformMachineReleaseSummarySchema,
});

export type PlatformMachineFinalizeReleaseUploadResult = z.infer<
  typeof platformMachineFinalizeReleaseUploadResultSchema
>;

export const platformMachinePublishReleaseResultSchema = z.object({
  release: platformMachineReleaseSummarySchema,
});

export type PlatformMachinePublishReleaseResult = z.infer<
  typeof platformMachinePublishReleaseResultSchema
>;
