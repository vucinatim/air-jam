import type { ArcadeVisibility } from "@/lib/games/arcade-visibility";
import type { GameConfig } from "@/lib/games/game-config-contract";
import type {
  GameMediaKind,
  GameMediaStatus,
} from "@/lib/games/game-media-contract";
import type {
  ProductTelemetryActorClass,
  ProductTelemetryAgentFamily,
  ProductTelemetryAgentResource,
  ProductTelemetryDeploymentEnvironment,
  ProductTelemetryExternalTarget,
  ProductTelemetryPlacement,
  ProductTelemetryReferrerSource,
  ProductTelemetryStoredEventKind,
  ProductTelemetrySurface,
} from "@/lib/product-telemetry-contract";
import type {
  GameReleaseSourceKind,
  GameReleaseStatus,
  ReleaseCheckKind,
  ReleaseCheckStatus,
  ReleaseReportSource,
  ReleaseReportStatus,
} from "@/lib/releases/release-contract";
import { createRuntimeDatabaseSchema } from "@air-jam/database-contract";
import type { PlatformMachineDeviceGrantStatus } from "@air-jam/sdk/platform-machine";
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["creator", "ops_admin"]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
  role: userRoleEnum("role").default("creator").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verificationTokens = pgTable("verification_tokens", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const machineAuthDeviceGrants = pgTable(
  "machine_auth_device_grants",
  {
    id: text("id").primaryKey(),
    deviceCode: text("device_code").notNull().unique(),
    userCode: text("user_code").notNull().unique(),
    clientName: text("client_name"),
    status: text("status").$type<PlatformMachineDeviceGrantStatus>().notNull(),
    userId: text("user_id").references(() => users.id),
    sessionToken: text("session_token"),
    expiresAt: timestamp("expires_at").notNull(),
    approvedAt: timestamp("approved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    deviceCodeIdx: index("machine_auth_device_grants_device_code_idx").on(
      table.deviceCode,
    ),
    userCodeIdx: index("machine_auth_device_grants_user_code_idx").on(
      table.userCode,
    ),
    statusIdx: index("machine_auth_device_grants_status_idx").on(table.status),
    expiresAtIdx: index("machine_auth_device_grants_expires_at_idx").on(
      table.expiresAt,
    ),
    userIdx: index("machine_auth_device_grants_user_id_idx").on(table.userId),
  }),
);

export const games = pgTable(
  "games",
  {
    id: text("id").primaryKey(), // Changed to text to match user ID style or keep UUID if preferred, but text is easier with BetterAuth user IDs
    userId: text("user_id")
      .references(() => users.id)
      .notNull(),
    name: text("name").notNull(),
    slug: text("slug").unique(), // For pretty URLs
    description: text("description"),
    url: text("url"), // Optional creator-only preview URL used for local/external iframe testing
    thumbnailMediaAssetId: text("thumbnail_media_asset_id"),
    coverMediaAssetId: text("cover_media_asset_id"),
    previewVideoMediaAssetId: text("preview_video_media_asset_id"),
    arcadeVisibility: text("arcade_visibility")
      .$type<ArcadeVisibility>()
      .default("hidden")
      .notNull(),
    // Schema-owned JSON bucket. See `@/lib/games/game-config-contract` for the
    // Zod schema and validation helpers. All write paths MUST validate via
    // `parseGameConfig` before persisting.
    config: jsonb("config")
      .$type<GameConfig>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("games_user_id_idx").on(table.userId),
  }),
);

export const {
  appIds,
  runtimeUsageSessions,
  runtimeUsageEvents,
  runtimeUsageControllerSegments,
  runtimeUsageGameSegments,
  runtimeUsageEligibleSegments,
  runtimeUsageGameSessionMetrics,
  runtimeUsageDailyGameMetrics,
} = createRuntimeDatabaseSchema({
  appIdGameIdReference: () => games.id,
});

export const gameReleases = pgTable(
  "game_releases",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    sourceKind: text("source_kind").$type<GameReleaseSourceKind>().notNull(),
    status: text("status").$type<GameReleaseStatus>().notNull(),
    versionLabel: text("version_label"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    uploadedAt: timestamp("uploaded_at"),
    checkedAt: timestamp("checked_at"),
    publishedAt: timestamp("published_at"),
    quarantinedAt: timestamp("quarantined_at"),
    archivedAt: timestamp("archived_at"),
  },
  (table) => ({
    gameIdx: index("game_releases_game_id_idx").on(table.gameId),
    statusIdx: index("game_releases_status_idx").on(table.status),
    createdAtIdx: index("game_releases_created_at_idx").on(table.createdAt),
  }),
);

export const gameReleaseArtifacts = pgTable(
  "game_release_artifacts",
  {
    id: text("id").primaryKey(),
    releaseId: text("release_id")
      .references(() => gameReleases.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    originalFilename: text("original_filename").notNull(),
    contentType: text("content_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    extractedSizeBytes: integer("extracted_size_bytes"),
    fileCount: integer("file_count"),
    zipObjectKey: text("zip_object_key").notNull(),
    siteRootKey: text("site_root_key").notNull(),
    entryPath: text("entry_path").notNull(),
    contentHash: text("content_hash"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    releaseIdx: index("game_release_artifacts_release_id_idx").on(
      table.releaseId,
    ),
    createdAtIdx: index("game_release_artifacts_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export const gameReleaseChecks = pgTable(
  "game_release_checks",
  {
    id: text("id").primaryKey(),
    releaseId: text("release_id")
      .references(() => gameReleases.id, { onDelete: "cascade" })
      .notNull(),
    kind: text("kind").$type<ReleaseCheckKind>().notNull(),
    status: text("status").$type<ReleaseCheckStatus>().notNull(),
    summary: text("summary"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    releaseIdx: index("game_release_checks_release_id_idx").on(table.releaseId),
    kindIdx: index("game_release_checks_kind_idx").on(table.kind),
    statusIdx: index("game_release_checks_status_idx").on(table.status),
    createdAtIdx: index("game_release_checks_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export const gameReleaseReports = pgTable(
  "game_release_reports",
  {
    id: text("id").primaryKey(),
    releaseId: text("release_id")
      .references(() => gameReleases.id, { onDelete: "cascade" })
      .notNull(),
    status: text("status").$type<ReleaseReportStatus>().notNull(),
    source: text("source").$type<ReleaseReportSource>().notNull(),
    reason: text("reason").notNull(),
    details: text("details"),
    reporterEmail: text("reporter_email"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    reviewedAt: timestamp("reviewed_at"),
  },
  (table) => ({
    releaseIdx: index("game_release_reports_release_id_idx").on(
      table.releaseId,
    ),
    statusIdx: index("game_release_reports_status_idx").on(table.status),
    createdAtIdx: index("game_release_reports_created_at_idx").on(
      table.createdAt,
    ),
  }),
);

export const gameMediaAssets = pgTable(
  "game_media_assets",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    kind: text("kind").$type<GameMediaKind>().notNull(),
    status: text("status").$type<GameMediaStatus>().notNull(),
    originalFilename: text("original_filename").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    checksum: text("checksum"),
    storageKey: text("storage_key").notNull().unique(),
    width: integer("width"),
    height: integer("height"),
    durationSeconds: integer("duration_seconds"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    gameIdx: index("game_media_assets_game_id_idx").on(table.gameId),
    kindIdx: index("game_media_assets_kind_idx").on(table.kind),
    statusIdx: index("game_media_assets_status_idx").on(table.status),
    createdAtIdx: index("game_media_assets_created_at_idx").on(table.createdAt),
  }),
);

export const productTelemetryEvents = pgTable(
  "product_telemetry_events",
  {
    id: text("id").primaryKey(),
    schemaVersion: integer("schema_version").notNull(),
    kind: text("kind").$type<ProductTelemetryStoredEventKind>().notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    anonymousSessionId: text("anonymous_session_id"),
    surface: text("surface").$type<ProductTelemetrySurface>().notNull(),
    pageKey: text("page_key").notNull(),
    actorClass: text("actor_class")
      .$type<ProductTelemetryActorClass>()
      .notNull(),
    agentFamily: text("agent_family").$type<ProductTelemetryAgentFamily>(),
    referrerSource: text("referrer_source")
      .$type<ProductTelemetryReferrerSource>()
      .notNull(),
    referrerHost: text("referrer_host"),
    campaignSource: text("campaign_source"),
    campaignMedium: text("campaign_medium"),
    campaignName: text("campaign_name"),
    placement: text("placement").$type<ProductTelemetryPlacement>(),
    externalTarget:
      text("external_target").$type<ProductTelemetryExternalTarget>(),
    agentResource:
      text("agent_resource").$type<ProductTelemetryAgentResource>(),
    deploymentEnvironment: text("deployment_environment")
      .$type<ProductTelemetryDeploymentEnvironment>()
      .notNull(),
    deploymentId: text("deployment_id").notNull(),
  },
  (table) => ({
    occurredAtIdx: index("product_telemetry_events_occurred_at_idx").on(
      table.occurredAt,
    ),
    receivedAtIdx: index("product_telemetry_events_received_at_idx").on(
      table.receivedAt,
    ),
    kindIdx: index("product_telemetry_events_kind_idx").on(table.kind),
    surfaceIdx: index("product_telemetry_events_surface_idx").on(table.surface),
    actorClassIdx: index("product_telemetry_events_actor_class_idx").on(
      table.actorClass,
    ),
    deploymentIdx: index("product_telemetry_events_deployment_idx").on(
      table.deploymentEnvironment,
      table.deploymentId,
    ),
  }),
);

export const productTelemetryDailyMetrics = pgTable(
  "product_telemetry_daily_metrics",
  {
    id: text("id").primaryKey(),
    bucketDate: date("bucket_date").notNull(),
    kind: text("kind").$type<ProductTelemetryStoredEventKind>().notNull(),
    surface: text("surface").$type<ProductTelemetrySurface>().notNull(),
    pageKey: text("page_key").notNull(),
    actorClass: text("actor_class")
      .$type<ProductTelemetryActorClass>()
      .notNull(),
    agentFamily: text("agent_family").$type<ProductTelemetryAgentFamily>(),
    referrerSource: text("referrer_source")
      .$type<ProductTelemetryReferrerSource>()
      .notNull(),
    referrerHost: text("referrer_host"),
    campaignSource: text("campaign_source"),
    campaignMedium: text("campaign_medium"),
    campaignName: text("campaign_name"),
    placement: text("placement").$type<ProductTelemetryPlacement>(),
    externalTarget:
      text("external_target").$type<ProductTelemetryExternalTarget>(),
    agentResource:
      text("agent_resource").$type<ProductTelemetryAgentResource>(),
    deploymentEnvironment: text("deployment_environment")
      .$type<ProductTelemetryDeploymentEnvironment>()
      .notNull(),
    deploymentId: text("deployment_id").notNull(),
    eventCount: integer("event_count").default(0).notNull(),
    anonymousSessionCount: integer("anonymous_session_count")
      .default(0)
      .notNull(),
    firstOccurredAt: timestamp("first_occurred_at", {
      withTimezone: true,
    }).notNull(),
    lastOccurredAt: timestamp("last_occurred_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    bucketDateIdx: index("product_telemetry_daily_metrics_bucket_date_idx").on(
      table.bucketDate,
    ),
    kindIdx: index("product_telemetry_daily_metrics_kind_idx").on(table.kind),
    surfaceIdx: index("product_telemetry_daily_metrics_surface_idx").on(
      table.surface,
    ),
    deploymentIdx: index("product_telemetry_daily_metrics_deployment_idx").on(
      table.deploymentEnvironment,
      table.deploymentId,
    ),
  }),
);

export const productTelemetryDailySessionContributions = pgTable(
  "product_telemetry_daily_session_contributions",
  {
    id: text("id").primaryKey(),
    metricId: text("metric_id").notNull(),
    bucketDate: date("bucket_date").notNull(),
    anonymousSessionId: text("anonymous_session_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    metricFk: foreignKey({
      name: "pt_session_contributions_metric_fk",
      columns: [table.metricId],
      foreignColumns: [productTelemetryDailyMetrics.id],
    }).onDelete("cascade"),
    metricSessionIdx: uniqueIndex(
      "pt_session_contributions_metric_session_uidx",
    ).on(table.metricId, table.anonymousSessionId),
    bucketDateIdx: index("pt_session_contributions_bucket_date_idx").on(
      table.bucketDate,
    ),
  }),
);
