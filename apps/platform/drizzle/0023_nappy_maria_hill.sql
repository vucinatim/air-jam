CREATE TABLE "operational_control_events" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"action" text NOT NULL,
	"lane" text NOT NULL,
	"expected_revision" integer NOT NULL,
	"previous" jsonb NOT NULL,
	"next" jsonb NOT NULL,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_control_events_action_check" CHECK ("operational_control_events"."action" = 'set_lane_mode'),
	CONSTRAINT "operational_control_events_lane_check" CHECK ("operational_control_events"."lane" in ('release_submission', 'artifact_ingestion', 'release_processing', 'browser_validation', 'moderation', 'media_ingestion', 'product_telemetry', 'realtime_room_admission', 'realtime_controller_admission', 'preview_capacity', 'lifecycle_cleanup')),
	CONSTRAINT "operational_control_events_expected_revision_check" CHECK ("operational_control_events"."expected_revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "operational_lane_controls" (
	"lane" text PRIMARY KEY NOT NULL,
	"mode" text DEFAULT 'normal' NOT NULL,
	"reason" text,
	"retry_after_seconds" integer,
	"revision" integer DEFAULT 1 NOT NULL,
	"updated_by" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_lane_controls_lane_check" CHECK ("operational_lane_controls"."lane" in ('release_submission', 'artifact_ingestion', 'release_processing', 'browser_validation', 'moderation', 'media_ingestion', 'product_telemetry', 'realtime_room_admission', 'realtime_controller_admission', 'preview_capacity', 'lifecycle_cleanup')),
	CONSTRAINT "operational_lane_controls_mode_check" CHECK ("operational_lane_controls"."mode" in ('normal', 'restricted', 'paused')),
	CONSTRAINT "operational_lane_controls_retry_after_check" CHECK ("operational_lane_controls"."retry_after_seconds" is null or "operational_lane_controls"."retry_after_seconds" > 0),
	CONSTRAINT "operational_lane_controls_revision_check" CHECK ("operational_lane_controls"."revision" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "operational_control_events_idempotency_key_uidx" ON "operational_control_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "operational_control_events_lane_created_at_idx" ON "operational_control_events" USING btree ("lane","created_at");--> statement-breakpoint
CREATE INDEX "operational_lane_controls_mode_idx" ON "operational_lane_controls" USING btree ("mode");--> statement-breakpoint
CREATE INDEX "operational_lane_controls_updated_at_idx" ON "operational_lane_controls" USING btree ("updated_at");
