CREATE TABLE "runtime_usage_daily_game_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"bucket_date" date NOT NULL,
	"app_id" text,
	"game_id" text NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"total_game_active_seconds" integer DEFAULT 0 NOT NULL,
	"total_controller_seconds" integer DEFAULT 0 NOT NULL,
	"total_eligible_playtime_seconds" integer DEFAULT 0 NOT NULL,
	"peak_concurrent_controllers" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runtime_usage_game_session_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"runtime_session_id" text NOT NULL,
	"room_id" text NOT NULL,
	"app_id" text,
	"game_id" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"controller_seconds" integer DEFAULT 0 NOT NULL,
	"eligible_playtime_seconds" integer DEFAULT 0 NOT NULL,
	"peak_concurrent_controllers" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "runtime_usage_game_session_metrics" ADD CONSTRAINT "runtime_usage_game_session_metrics_runtime_session_id_runtime_usage_sessions_id_fk" FOREIGN KEY ("runtime_session_id") REFERENCES "public"."runtime_usage_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "runtime_usage_daily_game_metrics_bucket_date_idx" ON "runtime_usage_daily_game_metrics" USING btree ("bucket_date");--> statement-breakpoint
CREATE INDEX "runtime_usage_daily_game_metrics_game_id_idx" ON "runtime_usage_daily_game_metrics" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_game_session_metrics_runtime_session_id_idx" ON "runtime_usage_game_session_metrics" USING btree ("runtime_session_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_game_session_metrics_game_id_idx" ON "runtime_usage_game_session_metrics" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "runtime_usage_game_session_metrics_started_at_idx" ON "runtime_usage_game_session_metrics" USING btree ("started_at");