CREATE TABLE "runtime_usage_controller_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"runtime_session_id" text NOT NULL,
	"room_id" text NOT NULL,
	"app_id" text,
	"controller_id" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"start_event_id" text NOT NULL,
	"end_event_id" text,
	"end_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_usage_eligible_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"runtime_session_id" text NOT NULL,
	"room_id" text NOT NULL,
	"app_id" text,
	"game_id" text,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"start_event_id" text NOT NULL,
	"end_event_id" text,
	"start_reason" text,
	"end_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp NOT NULL,
	"runtime_session_id" text,
	"room_id" text,
	"app_id" text,
	"game_id" text,
	"host_verified_via" text,
	"host_verified_origin" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_usage_game_segments" (
	"id" text PRIMARY KEY NOT NULL,
	"runtime_session_id" text NOT NULL,
	"room_id" text NOT NULL,
	"app_id" text,
	"game_id" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"start_event_id" text NOT NULL,
	"end_event_id" text,
	"start_reason" text,
	"end_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_usage_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"app_id" text,
	"host_verified_via" text,
	"host_verified_origin" text,
	"started_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runtime_usage_controller_segments" ADD CONSTRAINT "runtime_usage_controller_segments_runtime_session_id_runtime_usage_sessions_id_fk" FOREIGN KEY ("runtime_session_id") REFERENCES "public"."runtime_usage_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_usage_eligible_segments" ADD CONSTRAINT "runtime_usage_eligible_segments_runtime_session_id_runtime_usage_sessions_id_fk" FOREIGN KEY ("runtime_session_id") REFERENCES "public"."runtime_usage_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_usage_events" ADD CONSTRAINT "runtime_usage_events_runtime_session_id_runtime_usage_sessions_id_fk" FOREIGN KEY ("runtime_session_id") REFERENCES "public"."runtime_usage_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "runtime_usage_game_segments" ADD CONSTRAINT "runtime_usage_game_segments_runtime_session_id_runtime_usage_sessions_id_fk" FOREIGN KEY ("runtime_session_id") REFERENCES "public"."runtime_usage_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runtime_usage_controller_segments_runtime_session_id_idx" ON "runtime_usage_controller_segments" USING btree ("runtime_session_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_controller_segments_controller_id_idx" ON "runtime_usage_controller_segments" USING btree ("controller_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_controller_segments_started_at_idx" ON "runtime_usage_controller_segments" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "runtime_usage_eligible_segments_runtime_session_id_idx" ON "runtime_usage_eligible_segments" USING btree ("runtime_session_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_eligible_segments_game_id_idx" ON "runtime_usage_eligible_segments" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_eligible_segments_started_at_idx" ON "runtime_usage_eligible_segments" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "runtime_usage_events_kind_idx" ON "runtime_usage_events" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "runtime_usage_events_occurred_at_idx" ON "runtime_usage_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "runtime_usage_events_runtime_session_id_idx" ON "runtime_usage_events" USING btree ("runtime_session_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_events_room_id_idx" ON "runtime_usage_events" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_events_app_id_idx" ON "runtime_usage_events" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_game_segments_runtime_session_id_idx" ON "runtime_usage_game_segments" USING btree ("runtime_session_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_game_segments_game_id_idx" ON "runtime_usage_game_segments" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_game_segments_started_at_idx" ON "runtime_usage_game_segments" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "runtime_usage_sessions_app_id_idx" ON "runtime_usage_sessions" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_sessions_started_at_idx" ON "runtime_usage_sessions" USING btree ("started_at");