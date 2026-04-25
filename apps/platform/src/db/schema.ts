import type { ArcadeVisibility } from "@/lib/games/arcade-visibility";
import type { GameConfig } from "@/lib/games/game-config-contract";
import type {
  GameMediaKind,
  GameMediaStatus,
} from "@/lib/games/game-media-contract";
import type {
  GameReleaseSourceKind,
  GameReleaseStatus,
  ReleaseCheckKind,
  ReleaseCheckStatus,
  ReleaseReportSource,
  ReleaseReportStatus,
} from "@/lib/releases/release-contract";
import type { PlatformMachineDeviceGrantStatus } from "@air-jam/sdk/platform-machine";
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
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

export const appIds = pgTable("app_ids", {
  id: text("id").primaryKey(),
  gameId: text("game_id")
    .references(() => games.id)
    .notNull()
    .unique(), // One app identity record per game
  key: text("key").notNull().unique(), // The public app ID string (e.g. aj_app_...)
  allowedOrigins: jsonb("allowed_origins").$type<string[]>(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
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

export const runtimeUsageSessions = pgTable(
  "runtime_usage_sessions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id").notNull(),
    appId: text("app_id"),
    hostVerifiedVia: text("host_verified_via"),
    hostVerifiedOrigin: text("host_verified_origin"),
    startedAt: timestamp("started_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    appIdIdx: index("runtime_usage_sessions_app_id_idx").on(table.appId),
    startedAtIdx: index("runtime_usage_sessions_started_at_idx").on(
      table.startedAt,
    ),
  }),
);

export const runtimeUsageEvents = pgTable(
  "runtime_usage_events",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    runtimeSessionId: text("runtime_session_id").references(
      () => runtimeUsageSessions.id,
      { onDelete: "set null" },
    ),
    roomId: text("room_id"),
    appId: text("app_id"),
    gameId: text("game_id"),
    hostVerifiedVia: text("host_verified_via"),
    hostVerifiedOrigin: text("host_verified_origin"),
    payload: jsonb("payload")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    kindIdx: index("runtime_usage_events_kind_idx").on(table.kind),
    occurredAtIdx: index("runtime_usage_events_occurred_at_idx").on(
      table.occurredAt,
    ),
    runtimeSessionIdIdx: index(
      "runtime_usage_events_runtime_session_id_idx",
    ).on(table.runtimeSessionId),
    roomIdIdx: index("runtime_usage_events_room_id_idx").on(table.roomId),
    appIdIdx: index("runtime_usage_events_app_id_idx").on(table.appId),
  }),
);

export const runtimeUsageControllerSegments = pgTable(
  "runtime_usage_controller_segments",
  {
    id: text("id").primaryKey(),
    runtimeSessionId: text("runtime_session_id")
      .references(() => runtimeUsageSessions.id, { onDelete: "cascade" })
      .notNull(),
    roomId: text("room_id").notNull(),
    appId: text("app_id"),
    controllerId: text("controller_id").notNull(),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
    startEventId: text("start_event_id").notNull(),
    endEventId: text("end_event_id"),
    endReason: text("end_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    runtimeSessionIdx: index(
      "runtime_usage_controller_segments_runtime_session_id_idx",
    ).on(table.runtimeSessionId),
    controllerIdx: index(
      "runtime_usage_controller_segments_controller_id_idx",
    ).on(table.controllerId),
    startedAtIdx: index("runtime_usage_controller_segments_started_at_idx").on(
      table.startedAt,
    ),
  }),
);

export const runtimeUsageGameSegments = pgTable(
  "runtime_usage_game_segments",
  {
    id: text("id").primaryKey(),
    runtimeSessionId: text("runtime_session_id")
      .references(() => runtimeUsageSessions.id, { onDelete: "cascade" })
      .notNull(),
    roomId: text("room_id").notNull(),
    appId: text("app_id"),
    gameId: text("game_id").notNull(),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
    startEventId: text("start_event_id").notNull(),
    endEventId: text("end_event_id"),
    startReason: text("start_reason"),
    endReason: text("end_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    runtimeSessionIdx: index(
      "runtime_usage_game_segments_runtime_session_id_idx",
    ).on(table.runtimeSessionId),
    gameIdx: index("runtime_usage_game_segments_game_id_idx").on(table.gameId),
    startedAtIdx: index("runtime_usage_game_segments_started_at_idx").on(
      table.startedAt,
    ),
  }),
);

export const runtimeUsageEligibleSegments = pgTable(
  "runtime_usage_eligible_segments",
  {
    id: text("id").primaryKey(),
    runtimeSessionId: text("runtime_session_id")
      .references(() => runtimeUsageSessions.id, { onDelete: "cascade" })
      .notNull(),
    roomId: text("room_id").notNull(),
    appId: text("app_id"),
    gameId: text("game_id"),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
    startEventId: text("start_event_id").notNull(),
    endEventId: text("end_event_id"),
    startReason: text("start_reason"),
    endReason: text("end_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    runtimeSessionIdx: index(
      "runtime_usage_eligible_segments_runtime_session_id_idx",
    ).on(table.runtimeSessionId),
    gameIdx: index("runtime_usage_eligible_segments_game_id_idx").on(
      table.gameId,
    ),
    startedAtIdx: index("runtime_usage_eligible_segments_started_at_idx").on(
      table.startedAt,
    ),
  }),
);

export const runtimeUsageGameSessionMetrics = pgTable(
  "runtime_usage_game_session_metrics",
  {
    id: text("id").primaryKey(),
    runtimeSessionId: text("runtime_session_id")
      .references(() => runtimeUsageSessions.id, { onDelete: "cascade" })
      .notNull(),
    roomId: text("room_id").notNull(),
    appId: text("app_id"),
    gameId: text("game_id").notNull(),
    startedAt: timestamp("started_at").notNull(),
    endedAt: timestamp("ended_at"),
    controllerSeconds: integer("controller_seconds").default(0).notNull(),
    rawEligiblePlaytimeSeconds: integer("raw_eligible_playtime_seconds")
      .default(0)
      .notNull(),
    eligiblePlaytimeSeconds: integer("eligible_playtime_seconds")
      .default(0)
      .notNull(),
    trustFlags: jsonb("trust_flags")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    peakConcurrentControllers: integer("peak_concurrent_controllers")
      .default(0)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    runtimeSessionIdx: index(
      "runtime_usage_game_session_metrics_runtime_session_id_idx",
    ).on(table.runtimeSessionId),
    gameIdx: index("runtime_usage_game_session_metrics_game_id_idx").on(
      table.gameId,
    ),
    startedAtIdx: index("runtime_usage_game_session_metrics_started_at_idx").on(
      table.startedAt,
    ),
  }),
);

export const runtimeUsageDailyGameMetrics = pgTable(
  "runtime_usage_daily_game_metrics",
  {
    id: text("id").primaryKey(),
    bucketDate: date("bucket_date").notNull(),
    appId: text("app_id"),
    gameId: text("game_id").notNull(),
    sessionCount: integer("session_count").default(0).notNull(),
    totalGameActiveSeconds: integer("total_game_active_seconds")
      .default(0)
      .notNull(),
    totalControllerSeconds: integer("total_controller_seconds")
      .default(0)
      .notNull(),
    totalRawEligiblePlaytimeSeconds: integer(
      "total_raw_eligible_playtime_seconds",
    )
      .default(0)
      .notNull(),
    totalEligiblePlaytimeSeconds: integer("total_eligible_playtime_seconds")
      .default(0)
      .notNull(),
    guardedSessionCount: integer("guarded_session_count").default(0).notNull(),
    peakConcurrentControllers: integer("peak_concurrent_controllers")
      .default(0)
      .notNull(),
    lastActivityAt: timestamp("last_activity_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    bucketIdx: index("runtime_usage_daily_game_metrics_bucket_date_idx").on(
      table.bucketDate,
    ),
    gameIdx: index("runtime_usage_daily_game_metrics_game_id_idx").on(
      table.gameId,
    ),
  }),
);
