import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull(),
  image: text("image"),
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

export const games = pgTable("games", {
  id: text("id").primaryKey(), // Changed to text to match user ID style or keep UUID if preferred, but text is easier with BetterAuth user IDs
  userId: text("user_id")
    .references(() => users.id)
    .notNull(),
  name: text("name").notNull(),
  slug: text("slug").unique(), // For pretty URLs
  description: text("description"),
  url: text("url").notNull(), // The URL where the game is hosted
  thumbnailUrl: text("thumbnail_url"),
  videoUrl: text("video_url"),
  coverUrl: text("cover_url"),
  isPublished: boolean("is_published").default(false).notNull(),
  config: jsonb("config").default(sql`'{}'::jsonb`).notNull(), // Game specific configuration variables
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
    runtimeSessionIdIdx: index("runtime_usage_events_runtime_session_id_idx").on(
      table.runtimeSessionId,
    ),
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
    controllerIdx: index("runtime_usage_controller_segments_controller_id_idx").on(
      table.controllerId,
    ),
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
    runtimeSessionIdx: index("runtime_usage_game_segments_runtime_session_id_idx").on(
      table.runtimeSessionId,
    ),
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
    eligiblePlaytimeSeconds: integer("eligible_playtime_seconds")
      .default(0)
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
    totalEligiblePlaytimeSeconds: integer("total_eligible_playtime_seconds")
      .default(0)
      .notNull(),
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
