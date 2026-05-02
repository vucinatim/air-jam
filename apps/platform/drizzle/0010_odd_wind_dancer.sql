ALTER TABLE "runtime_usage_daily_game_metrics" ADD COLUMN "total_raw_eligible_playtime_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "runtime_usage_daily_game_metrics" ADD COLUMN "guarded_session_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "runtime_usage_game_session_metrics" ADD COLUMN "raw_eligible_playtime_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "runtime_usage_game_session_metrics" ADD COLUMN "trust_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;