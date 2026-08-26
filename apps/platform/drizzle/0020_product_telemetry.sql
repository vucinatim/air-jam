CREATE TABLE "product_telemetry_daily_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"bucket_date" date NOT NULL,
	"kind" text NOT NULL,
	"surface" text NOT NULL,
	"page_key" text NOT NULL,
	"actor_class" text NOT NULL,
	"agent_family" text,
	"referrer_source" text NOT NULL,
	"referrer_host" text,
	"campaign_source" text,
	"campaign_medium" text,
	"campaign_name" text,
	"placement" text,
	"external_target" text,
	"agent_resource" text,
	"deployment_environment" text NOT NULL,
	"deployment_id" text NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"anonymous_session_count" integer DEFAULT 0 NOT NULL,
	"first_occurred_at" timestamp with time zone NOT NULL,
	"last_occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_telemetry_daily_session_contributions" (
	"id" text PRIMARY KEY NOT NULL,
	"metric_id" text NOT NULL,
	"bucket_date" date NOT NULL,
	"anonymous_session_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_telemetry_events" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_version" integer NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"anonymous_session_id" text,
	"surface" text NOT NULL,
	"page_key" text NOT NULL,
	"actor_class" text NOT NULL,
	"agent_family" text,
	"referrer_source" text NOT NULL,
	"referrer_host" text,
	"campaign_source" text,
	"campaign_medium" text,
	"campaign_name" text,
	"placement" text,
	"external_target" text,
	"agent_resource" text,
	"deployment_environment" text NOT NULL,
	"deployment_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_telemetry_daily_session_contributions" ADD CONSTRAINT "pt_session_contributions_metric_fk" FOREIGN KEY ("metric_id") REFERENCES "public"."product_telemetry_daily_metrics"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "product_telemetry_daily_metrics_bucket_date_idx" ON "product_telemetry_daily_metrics" USING btree ("bucket_date");
--> statement-breakpoint
CREATE INDEX "product_telemetry_daily_metrics_kind_idx" ON "product_telemetry_daily_metrics" USING btree ("kind");
--> statement-breakpoint
CREATE INDEX "product_telemetry_daily_metrics_surface_idx" ON "product_telemetry_daily_metrics" USING btree ("surface");
--> statement-breakpoint
CREATE INDEX "product_telemetry_daily_metrics_deployment_idx" ON "product_telemetry_daily_metrics" USING btree ("deployment_environment","deployment_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "pt_session_contributions_metric_session_uidx" ON "product_telemetry_daily_session_contributions" USING btree ("metric_id","anonymous_session_id");
--> statement-breakpoint
CREATE INDEX "pt_session_contributions_bucket_date_idx" ON "product_telemetry_daily_session_contributions" USING btree ("bucket_date");
--> statement-breakpoint
CREATE INDEX "product_telemetry_events_occurred_at_idx" ON "product_telemetry_events" USING btree ("occurred_at");
--> statement-breakpoint
CREATE INDEX "product_telemetry_events_received_at_idx" ON "product_telemetry_events" USING btree ("received_at");
--> statement-breakpoint
CREATE INDEX "product_telemetry_events_kind_idx" ON "product_telemetry_events" USING btree ("kind");
--> statement-breakpoint
CREATE INDEX "product_telemetry_events_surface_idx" ON "product_telemetry_events" USING btree ("surface");
--> statement-breakpoint
CREATE INDEX "product_telemetry_events_actor_class_idx" ON "product_telemetry_events" USING btree ("actor_class");
--> statement-breakpoint
CREATE INDEX "product_telemetry_events_deployment_idx" ON "product_telemetry_events" USING btree ("deployment_environment","deployment_id");
