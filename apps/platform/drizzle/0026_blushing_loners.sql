CREATE TABLE "operational_job_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_version" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"kind" text NOT NULL,
	"request_hash" text NOT NULL,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"request" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "operational_job_commands_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "operational_job_commands_contract_version_check" CHECK ("operational_job_commands"."contract_version" = 1),
	CONSTRAINT "operational_job_commands_kind_check" CHECK ("operational_job_commands"."kind" in ('enqueue', 'cancel', 'replay', 'repair_expired')),
	CONSTRAINT "operational_job_commands_required_text_check" CHECK (btrim("operational_job_commands"."id") <> '' and btrim("operational_job_commands"."idempotency_key") <> '' and btrim("operational_job_commands"."actor") <> '' and btrim("operational_job_commands"."reason") <> ''),
	CONSTRAINT "operational_job_commands_request_hash_check" CHECK ("operational_job_commands"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "operational_job_commands_json_shape_check" CHECK (jsonb_typeof("operational_job_commands"."request") = 'object' and ("operational_job_commands"."result" is null or jsonb_typeof("operational_job_commands"."result") = 'object')),
	CONSTRAINT "operational_job_commands_completion_check" CHECK (("operational_job_commands"."result" is null and "operational_job_commands"."completed_at" is null) or ("operational_job_commands"."result" is not null and "operational_job_commands"."completed_at" is not null and "operational_job_commands"."completed_at" >= "operational_job_commands"."created_at"))
);
--> statement-breakpoint
CREATE TABLE "operational_job_events" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"kind" text NOT NULL,
	"expected_revision" integer NOT NULL,
	"next_revision" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"attempt" integer NOT NULL,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"correlation_id" text NOT NULL,
	"causation_event_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_job_events_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "operational_job_events_kind_check" CHECK ("operational_job_events"."kind" in ('enqueued', 'claimed', 'stage_recorded', 'retry_scheduled', 'cancel_requested', 'canceled', 'succeeded', 'failed', 'lease_recovered', 'replayed')),
	CONSTRAINT "operational_job_events_revision_check" CHECK ("operational_job_events"."expected_revision" >= 0 and "operational_job_events"."next_revision" = "operational_job_events"."expected_revision" + 1),
	CONSTRAINT "operational_job_events_attempt_check" CHECK ("operational_job_events"."attempt" >= 0),
	CONSTRAINT "operational_job_events_required_text_check" CHECK (btrim("operational_job_events"."id") <> '' and btrim("operational_job_events"."job_id") <> '' and btrim("operational_job_events"."idempotency_key") <> '' and btrim("operational_job_events"."actor") <> '' and btrim("operational_job_events"."reason") <> '' and btrim("operational_job_events"."correlation_id") <> ''),
	CONSTRAINT "operational_job_events_details_shape_check" CHECK (jsonb_typeof("operational_job_events"."details") = 'object'),
	CONSTRAINT "operational_job_events_causation_check" CHECK ("operational_job_events"."causation_event_id" is null or "operational_job_events"."causation_event_id" <> "operational_job_events"."id")
);
--> statement-breakpoint
CREATE TABLE "operational_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_version" integer NOT NULL,
	"kind" text NOT NULL,
	"lane" text NOT NULL,
	"status" text NOT NULL,
	"creator_id" text NOT NULL,
	"game_id" text NOT NULL,
	"release_id" text NOT NULL,
	"created_by_command_id" text NOT NULL,
	"request_hash" text NOT NULL,
	"correlation_id" text NOT NULL,
	"replay_of_job_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"last_error" jsonb,
	"priority" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"lease_owner" text,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"last_heartbeat_at" timestamp with time zone,
	"cancel_requested_at" timestamp with time zone,
	"cancel_requested_by" text,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_jobs_created_by_command_id_unique" UNIQUE("created_by_command_id"),
	CONSTRAINT "operational_jobs_kind_check" CHECK ("operational_jobs"."kind" in ('release_artifact_processing', 'release_browser_validation', 'release_image_moderation')),
	CONSTRAINT "operational_jobs_contract_version_check" CHECK ("operational_jobs"."contract_version" = 1),
	CONSTRAINT "operational_jobs_required_text_check" CHECK (btrim("operational_jobs"."id") <> '' and btrim("operational_jobs"."creator_id") <> '' and btrim("operational_jobs"."game_id") <> '' and btrim("operational_jobs"."release_id") <> '' and btrim("operational_jobs"."created_by_command_id") <> '' and btrim("operational_jobs"."correlation_id") <> ''),
	CONSTRAINT "operational_jobs_request_hash_check" CHECK ("operational_jobs"."request_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "operational_jobs_json_shape_check" CHECK (jsonb_typeof("operational_jobs"."payload") = 'object' and jsonb_typeof("operational_jobs"."progress") = 'object' and ("operational_jobs"."result" is null or jsonb_typeof("operational_jobs"."result") = 'object') and ("operational_jobs"."last_error" is null or jsonb_typeof("operational_jobs"."last_error") = 'object')),
	CONSTRAINT "operational_jobs_replay_check" CHECK ("operational_jobs"."replay_of_job_id" is null or "operational_jobs"."replay_of_job_id" <> "operational_jobs"."id"),
	CONSTRAINT "operational_jobs_status_check" CHECK ("operational_jobs"."status" in ('queued', 'running', 'cancel_requested', 'succeeded', 'failed', 'canceled')),
	CONSTRAINT "operational_jobs_kind_lane_check" CHECK (("operational_jobs"."kind" = 'release_artifact_processing' and "operational_jobs"."lane" = 'release_processing') or ("operational_jobs"."kind" = 'release_browser_validation' and "operational_jobs"."lane" = 'browser_validation') or ("operational_jobs"."kind" = 'release_image_moderation' and "operational_jobs"."lane" = 'moderation')),
	CONSTRAINT "operational_jobs_attempts_check" CHECK ("operational_jobs"."attempt_count" >= 0 and "operational_jobs"."max_attempts" > 0 and "operational_jobs"."attempt_count" <= "operational_jobs"."max_attempts"),
	CONSTRAINT "operational_jobs_revision_check" CHECK ("operational_jobs"."revision" > 0),
	CONSTRAINT "operational_jobs_time_check" CHECK ("operational_jobs"."deadline_at" > "operational_jobs"."created_at"),
	CONSTRAINT "operational_jobs_lifecycle_check" CHECK ((
        "operational_jobs"."status" = 'queued'
        and "operational_jobs"."lease_owner" is null
        and "operational_jobs"."lease_token" is null
        and "operational_jobs"."lease_expires_at" is null
        and "operational_jobs"."finished_at" is null
      ) or (
        "operational_jobs"."status" in ('running', 'cancel_requested')
        and "operational_jobs"."lease_owner" is not null
        and "operational_jobs"."lease_token" is not null
        and "operational_jobs"."lease_expires_at" is not null
        and "operational_jobs"."last_heartbeat_at" is not null
        and "operational_jobs"."started_at" is not null
        and "operational_jobs"."finished_at" is null
      ) or (
        "operational_jobs"."status" in ('succeeded', 'failed', 'canceled')
        and "operational_jobs"."lease_owner" is null
        and "operational_jobs"."lease_token" is null
        and "operational_jobs"."lease_expires_at" is null
        and "operational_jobs"."finished_at" is not null
      )),
	CONSTRAINT "operational_jobs_cancel_check" CHECK ("operational_jobs"."status" <> 'cancel_requested' or ("operational_jobs"."cancel_requested_at" is not null and "operational_jobs"."cancel_requested_by" is not null and "operational_jobs"."cancel_reason" is not null)),
	CONSTRAINT "operational_jobs_terminal_evidence_check" CHECK (("operational_jobs"."status" <> 'succeeded' or "operational_jobs"."result" is not null) and ("operational_jobs"."status" <> 'failed' or "operational_jobs"."last_error" is not null)),
	CONSTRAINT "operational_jobs_lease_deadline_check" CHECK ("operational_jobs"."lease_expires_at" is null or "operational_jobs"."lease_expires_at" <= "operational_jobs"."deadline_at")
);
--> statement-breakpoint
ALTER TABLE "game_release_checks" ADD COLUMN "job_id" text;--> statement-breakpoint
ALTER TABLE "game_release_checks" ADD COLUMN "job_attempt" integer;--> statement-breakpoint
ALTER TABLE "operational_job_events" ADD CONSTRAINT "operational_job_events_job_id_operational_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."operational_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_job_events" ADD CONSTRAINT "operational_job_events_causation_fk" FOREIGN KEY ("causation_event_id") REFERENCES "public"."operational_job_events"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_created_by_command_id_operational_job_commands_id_fk" FOREIGN KEY ("created_by_command_id") REFERENCES "public"."operational_job_commands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_releases_game_scope_idx" ON "game_releases" USING btree ("id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "games_owner_scope_idx" ON "games" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_creator_scope_fk" FOREIGN KEY ("game_id","creator_id") REFERENCES "public"."games"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_release_scope_fk" FOREIGN KEY ("release_id","game_id") REFERENCES "public"."game_releases"("id","game_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "operational_jobs_job_release_scope_idx" ON "operational_jobs" USING btree ("id","release_id");--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_replay_of_fk" FOREIGN KEY ("replay_of_job_id","release_id") REFERENCES "public"."operational_jobs"("id","release_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operational_job_commands_kind_created_at_idx" ON "operational_job_commands" USING btree ("kind","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "operational_job_events_job_revision_idx" ON "operational_job_events" USING btree ("job_id","next_revision");--> statement-breakpoint
CREATE INDEX "operational_job_events_correlation_idx" ON "operational_job_events" USING btree ("correlation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "operational_jobs_active_resource_idx" ON "operational_jobs" USING btree ("kind","release_id") WHERE "operational_jobs"."status" in ('queued', 'running', 'cancel_requested');--> statement-breakpoint
CREATE INDEX "operational_jobs_queue_idx" ON "operational_jobs" USING btree ("kind","status","available_at","priority","created_at") WHERE "operational_jobs"."status" = 'queued';--> statement-breakpoint
CREATE INDEX "operational_jobs_lease_expiry_idx" ON "operational_jobs" USING btree ("lease_expires_at") WHERE "operational_jobs"."status" in ('running', 'cancel_requested');--> statement-breakpoint
CREATE INDEX "operational_jobs_creator_status_idx" ON "operational_jobs" USING btree ("creator_id","kind","status");--> statement-breakpoint
CREATE INDEX "operational_jobs_release_history_idx" ON "operational_jobs" USING btree ("release_id","created_at");--> statement-breakpoint
CREATE INDEX "operational_jobs_correlation_idx" ON "operational_jobs" USING btree ("correlation_id");--> statement-breakpoint
ALTER TABLE "game_release_checks" ADD CONSTRAINT "game_release_checks_job_release_scope_fk" FOREIGN KEY ("job_id","release_id") REFERENCES "public"."operational_jobs"("id","release_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_release_checks_job_id_idx" ON "game_release_checks" USING btree ("job_id");--> statement-breakpoint
ALTER TABLE "game_release_checks" ADD CONSTRAINT "game_release_checks_job_attempt_check" CHECK (("game_release_checks"."job_id" is null and "game_release_checks"."job_attempt" is null) or ("game_release_checks"."job_id" is not null and "game_release_checks"."job_attempt" > 0));
