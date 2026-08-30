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
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export type RuntimeDatabaseSchemaOptions = {
  appIdGameIdReference?: () => AnyPgColumn;
};

export const createRuntimeDatabaseSchema = ({
  appIdGameIdReference,
}: RuntimeDatabaseSchemaOptions = {}) => {
  const appIdGameIdColumn = appIdGameIdReference
    ? text("game_id").references(appIdGameIdReference)
    : text("game_id");

  const appIds = pgTable("app_ids", {
    id: text("id").primaryKey(),
    gameId: appIdGameIdColumn.notNull().unique(),
    key: text("key").notNull().unique(),
    allowedOrigins: jsonb("allowed_origins").$type<string[]>(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
  });

  const runtimeUsageSessions = pgTable(
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
    (table) => [
      index("runtime_usage_sessions_app_id_idx").on(table.appId),
      index("runtime_usage_sessions_started_at_idx").on(table.startedAt),
    ],
  );

  const runtimeUsageEvents = pgTable(
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
    (table) => [
      index("runtime_usage_events_kind_idx").on(table.kind),
      index("runtime_usage_events_occurred_at_idx").on(table.occurredAt),
      index("runtime_usage_events_runtime_session_id_idx").on(
        table.runtimeSessionId,
      ),
      index("runtime_usage_events_room_id_idx").on(table.roomId),
      index("runtime_usage_events_app_id_idx").on(table.appId),
    ],
  );

  const runtimeUsageControllerSegments = pgTable(
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
    (table) => [
      index("runtime_usage_controller_segments_runtime_session_id_idx").on(
        table.runtimeSessionId,
      ),
      index("runtime_usage_controller_segments_controller_id_idx").on(
        table.controllerId,
      ),
      index("runtime_usage_controller_segments_started_at_idx").on(
        table.startedAt,
      ),
    ],
  );

  const runtimeUsageGameSegments = pgTable(
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
    (table) => [
      index("runtime_usage_game_segments_runtime_session_id_idx").on(
        table.runtimeSessionId,
      ),
      index("runtime_usage_game_segments_game_id_idx").on(table.gameId),
      index("runtime_usage_game_segments_started_at_idx").on(table.startedAt),
    ],
  );

  const runtimeUsageEligibleSegments = pgTable(
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
    (table) => [
      index("runtime_usage_eligible_segments_runtime_session_id_idx").on(
        table.runtimeSessionId,
      ),
      index("runtime_usage_eligible_segments_game_id_idx").on(table.gameId),
      index("runtime_usage_eligible_segments_started_at_idx").on(
        table.startedAt,
      ),
    ],
  );

  const runtimeUsageGameSessionMetrics = pgTable(
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
    (table) => [
      index("runtime_usage_game_session_metrics_runtime_session_id_idx").on(
        table.runtimeSessionId,
      ),
      index("runtime_usage_game_session_metrics_game_id_idx").on(table.gameId),
      index("runtime_usage_game_session_metrics_started_at_idx").on(
        table.startedAt,
      ),
    ],
  );

  const runtimeUsageDailyGameMetrics = pgTable(
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
      guardedSessionCount: integer("guarded_session_count")
        .default(0)
        .notNull(),
      peakConcurrentControllers: integer("peak_concurrent_controllers")
        .default(0)
        .notNull(),
      lastActivityAt: timestamp("last_activity_at"),
      createdAt: timestamp("created_at").defaultNow().notNull(),
      updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
      index("runtime_usage_daily_game_metrics_bucket_date_idx").on(
        table.bucketDate,
      ),
      index("runtime_usage_daily_game_metrics_game_id_idx").on(table.gameId),
    ],
  );

  return {
    appIds,
    runtimeUsageSessions,
    runtimeUsageEvents,
    runtimeUsageControllerSegments,
    runtimeUsageGameSegments,
    runtimeUsageEligibleSegments,
    runtimeUsageGameSessionMetrics,
    runtimeUsageDailyGameMetrics,
  };
};

export type RuntimeDatabaseSchema = ReturnType<
  typeof createRuntimeDatabaseSchema
>;
