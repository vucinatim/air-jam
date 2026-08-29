import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

export const operationalLaneValues = [
  "release_submission",
  "artifact_ingestion",
  "release_processing",
  "browser_validation",
  "moderation",
  "media_ingestion",
  "product_telemetry",
  "realtime_room_admission",
  "realtime_controller_admission",
  "preview_capacity",
  "lifecycle_cleanup",
] as const;

export type OperationalLane = (typeof operationalLaneValues)[number];

export const operationalLaneModeValues = [
  "normal",
  "restricted",
  "paused",
] as const;

export type OperationalLaneMode = (typeof operationalLaneModeValues)[number];

const operationalLaneSqlList = sql.raw(
  operationalLaneValues.map((lane) => `'${lane}'`).join(", "),
);
const operationalLaneModeSqlList = sql.raw(
  operationalLaneModeValues.map((mode) => `'${mode}'`).join(", "),
);

export type OperationalLaneControlSnapshot = {
  lane: OperationalLane;
  mode: OperationalLaneMode;
  reason: string | null;
  retryAfterSeconds: number | null;
  revision: number;
  updatedBy: string | null;
  updatedAt: string | null;
};

export const operationalBudgetProfileValues = [
  "ordinary",
  "launch_1_0",
] as const;

export type OperationalBudgetProfile =
  (typeof operationalBudgetProfileValues)[number];

export const operationalBudgetStateValues = [
  "normal",
  "warning",
  "protection",
  "near_ceiling",
  "ceiling",
] as const;

export type OperationalBudgetState =
  (typeof operationalBudgetStateValues)[number];

export const operationalBudgetEvidenceContractVersion = 1 as const;

const operationalBudgetEvidenceContractVersionSql = sql.raw(
  String(operationalBudgetEvidenceContractVersion),
);

const operationalBudgetProfileSqlList = sql.raw(
  operationalBudgetProfileValues.map((profile) => `'${profile}'`).join(", "),
);

export type OperationalBudgetCycleSnapshot = {
  id: string;
  periodStart: string;
  periodEnd: string;
  profile: OperationalBudgetProfile;
  normalTargetMicrousd: number;
  warningMicrousd: number;
  protectionMicrousd: number;
  nearCeilingMicrousd: number;
  ceilingMicrousd: number;
  createdAt: string;
};

export type OperationalBudgetEvidenceSnapshot = {
  id: string;
  idempotencyKey: string;
  cycleId: string;
  contractVersion: number;
  provider: string;
  scopeKind: string;
  scopeId: string;
  scopeName: string;
  scopeMetadata: Record<string, unknown>;
  currency: "USD";
  observedAt: string;
  actualAmountMicrousd: number;
  projectedAmountMicrousd: number | null;
  measurements: Record<string, unknown>;
  costBreakdownMicrousd: Record<string, unknown>;
  rateCard: Record<string, unknown>;
  sourceVersion: string;
  collectedBy: string;
  reason: string;
  createdAt: string;
};

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

  const operationalLaneControls = pgTable(
    "operational_lane_controls",
    {
      lane: text("lane").$type<OperationalLane>().primaryKey(),
      mode: text("mode")
        .$type<OperationalLaneMode>()
        .default("normal")
        .notNull(),
      reason: text("reason"),
      retryAfterSeconds: integer("retry_after_seconds"),
      revision: integer("revision").default(1).notNull(),
      updatedBy: text("updated_by").notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      check(
        "operational_lane_controls_lane_check",
        sql`${table.lane} in (${operationalLaneSqlList})`,
      ),
      check(
        "operational_lane_controls_mode_check",
        sql`${table.mode} in (${operationalLaneModeSqlList})`,
      ),
      check(
        "operational_lane_controls_retry_after_check",
        sql`${table.retryAfterSeconds} is null or ${table.retryAfterSeconds} > 0`,
      ),
      check(
        "operational_lane_controls_revision_check",
        sql`${table.revision} > 0`,
      ),
      index("operational_lane_controls_mode_idx").on(table.mode),
      index("operational_lane_controls_updated_at_idx").on(table.updatedAt),
    ],
  );

  const operationalControlEvents = pgTable(
    "operational_control_events",
    {
      id: text("id").primaryKey(),
      idempotencyKey: text("idempotency_key").notNull(),
      action: text("action").$type<"set_lane_mode">().notNull(),
      lane: text("lane").$type<OperationalLane>().notNull(),
      expectedRevision: integer("expected_revision").notNull(),
      previous: jsonb("previous")
        .$type<OperationalLaneControlSnapshot>()
        .notNull(),
      next: jsonb("next").$type<OperationalLaneControlSnapshot>().notNull(),
      actor: text("actor").notNull(),
      reason: text("reason").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("operational_control_events_idempotency_key_uidx").on(
        table.idempotencyKey,
      ),
      index("operational_control_events_lane_created_at_idx").on(
        table.lane,
        table.createdAt,
      ),
      check(
        "operational_control_events_action_check",
        sql`${table.action} = 'set_lane_mode'`,
      ),
      check(
        "operational_control_events_lane_check",
        sql`${table.lane} in (${operationalLaneSqlList})`,
      ),
      check(
        "operational_control_events_expected_revision_check",
        sql`${table.expectedRevision} >= 0`,
      ),
    ],
  );

  const operationalBudgetCycles = pgTable(
    "operational_budget_cycles",
    {
      id: text("id").primaryKey(),
      periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
      periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
      profile: text("profile").$type<OperationalBudgetProfile>().notNull(),
      normalTargetMicrousd: bigint("normal_target_microusd", {
        mode: "number",
      }).notNull(),
      warningMicrousd: bigint("warning_microusd", {
        mode: "number",
      }).notNull(),
      protectionMicrousd: bigint("protection_microusd", {
        mode: "number",
      }).notNull(),
      nearCeilingMicrousd: bigint("near_ceiling_microusd", {
        mode: "number",
      }).notNull(),
      ceilingMicrousd: bigint("ceiling_microusd", {
        mode: "number",
      }).notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("operational_budget_cycles_period_uidx").on(
        table.periodStart,
        table.periodEnd,
      ),
      check(
        "operational_budget_cycles_period_check",
        sql`${table.periodEnd} > ${table.periodStart}`,
      ),
      check(
        "operational_budget_cycles_id_check",
        sql`length(btrim(${table.id})) > 0`,
      ),
      check(
        "operational_budget_cycles_profile_check",
        sql`${table.profile} in (${operationalBudgetProfileSqlList})`,
      ),
      check(
        "operational_budget_cycles_thresholds_check",
        sql`${table.normalTargetMicrousd} > 0 and ${table.warningMicrousd} > ${table.normalTargetMicrousd} and ${table.protectionMicrousd} > ${table.warningMicrousd} and ${table.nearCeilingMicrousd} > ${table.protectionMicrousd} and ${table.ceilingMicrousd} > ${table.nearCeilingMicrousd}`,
      ),
    ],
  );

  const operationalBudgetEvidence = pgTable(
    "operational_budget_evidence",
    {
      id: text("id").primaryKey(),
      idempotencyKey: text("idempotency_key").notNull(),
      cycleId: text("cycle_id")
        .notNull()
        .references(() => operationalBudgetCycles.id),
      contractVersion: integer("contract_version").notNull(),
      provider: text("provider").notNull(),
      scopeKind: text("scope_kind").notNull(),
      scopeId: text("scope_id").notNull(),
      scopeName: text("scope_name").notNull(),
      scopeMetadata: jsonb("scope_metadata")
        .$type<Record<string, unknown>>()
        .notNull(),
      currency: text("currency").$type<"USD">().default("USD").notNull(),
      observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
      actualAmountMicrousd: bigint("actual_amount_microusd", {
        mode: "number",
      }).notNull(),
      projectedAmountMicrousd: bigint("projected_amount_microusd", {
        mode: "number",
      }),
      measurements: jsonb("measurements")
        .$type<Record<string, unknown>>()
        .notNull(),
      costBreakdownMicrousd: jsonb("cost_breakdown_microusd")
        .$type<Record<string, unknown>>()
        .notNull(),
      rateCard: jsonb("rate_card").$type<Record<string, unknown>>().notNull(),
      sourceVersion: text("source_version").notNull(),
      collectedBy: text("collected_by").notNull(),
      reason: text("reason").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("operational_budget_evidence_idempotency_key_uidx").on(
        table.idempotencyKey,
      ),
      index("operational_budget_evidence_cycle_observed_at_idx").on(
        table.cycleId,
        table.observedAt,
      ),
      index("operational_budget_evidence_source_observed_at_idx").on(
        table.provider,
        table.scopeKind,
        table.scopeId,
        table.observedAt,
      ),
      check(
        "operational_budget_evidence_currency_check",
        sql`${table.currency} = 'USD'`,
      ),
      check(
        "operational_budget_evidence_contract_version_check",
        sql`${table.contractVersion} = ${operationalBudgetEvidenceContractVersionSql}`,
      ),
      check(
        "operational_budget_evidence_required_text_check",
        sql`length(btrim(${table.id})) > 0 and length(btrim(${table.idempotencyKey})) > 0 and length(btrim(${table.provider})) > 0 and length(btrim(${table.scopeKind})) > 0 and length(btrim(${table.scopeId})) > 0 and length(btrim(${table.scopeName})) > 0 and length(btrim(${table.sourceVersion})) > 0 and length(btrim(${table.collectedBy})) > 0 and length(btrim(${table.reason})) > 0`,
      ),
      check(
        "operational_budget_evidence_json_objects_check",
        sql`jsonb_typeof(${table.scopeMetadata}) = 'object' and jsonb_typeof(${table.measurements}) = 'object' and jsonb_typeof(${table.costBreakdownMicrousd}) = 'object' and jsonb_typeof(${table.rateCard}) = 'object'`,
      ),
      check(
        "operational_budget_evidence_actual_amount_check",
        sql`${table.actualAmountMicrousd} >= 0`,
      ),
      check(
        "operational_budget_evidence_projected_amount_check",
        sql`${table.projectedAmountMicrousd} is null or ${table.projectedAmountMicrousd} >= 0`,
      ),
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
    operationalLaneControls,
    operationalControlEvents,
    operationalBudgetCycles,
    operationalBudgetEvidence,
  };
};

export type RuntimeDatabaseSchema = ReturnType<
  typeof createRuntimeDatabaseSchema
>;
