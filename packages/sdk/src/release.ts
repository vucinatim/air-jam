import path from "node:path";
import { z } from "zod";

export const gameReleaseSourceKindValues = ["upload"] as const;
export type GameReleaseSourceKind =
  (typeof gameReleaseSourceKindValues)[number];
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
export type ReleaseReportStatus = (typeof releaseReportStatusValues)[number];
export const releaseReportStatusSchema = z.enum(releaseReportStatusValues);

export const releaseReportSourceValues = ["play_page", "arcade"] as const;
export type ReleaseReportSource = (typeof releaseReportSourceValues)[number];
export const releaseReportSourceSchema = z.enum(releaseReportSourceValues);

export const HOSTED_RELEASE_ENTRY_PATH = "index.html" as const;
export const HOSTED_RELEASE_MANIFEST_PATH =
  ".airjam/release-manifest.json" as const;
export const HOSTED_RELEASE_HOST_PATH = "/" as const;
export const HOSTED_RELEASE_CONTROLLER_PATH = "/controller" as const;

export const hostedReleaseArtifactManifestSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal("airjam-hosted-release"),
  routes: z.object({
    host: z.literal(HOSTED_RELEASE_HOST_PATH),
    controller: z.literal(HOSTED_RELEASE_CONTROLLER_PATH),
  }),
});

export type HostedReleaseArtifactManifest = z.infer<
  typeof hostedReleaseArtifactManifestSchema
>;

export const createHostedReleaseArtifactManifest =
  (): HostedReleaseArtifactManifest => ({
    schemaVersion: 1,
    kind: "airjam-hosted-release",
    routes: {
      host: HOSTED_RELEASE_HOST_PATH,
      controller: HOSTED_RELEASE_CONTROLLER_PATH,
    },
  });

const normalizeHostedReleaseRequestPath = (value: string): string =>
  value.replaceAll("\\", "/").replace(/^\/+/, "").replace(/\/+/g, "/").trim();

export const isHostedReleaseSpaFallbackPath = (
  relativePath: string,
): boolean => {
  const normalizedPath = normalizeHostedReleaseRequestPath(relativePath);
  if (!normalizedPath) {
    return false;
  }

  if (path.posix.extname(normalizedPath)) {
    return false;
  }

  return (
    normalizedPath === HOSTED_RELEASE_CONTROLLER_PATH.slice(1) ||
    normalizedPath.startsWith(`${HOSTED_RELEASE_CONTROLLER_PATH.slice(1)}/`)
  );
};
