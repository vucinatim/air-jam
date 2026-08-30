CREATE TABLE "operational_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"alert_key" text NOT NULL,
	"policy_id" text NOT NULL,
	"environment" text NOT NULL,
	"service" text NOT NULL,
	"severity" text NOT NULL,
	"status" text NOT NULL,
	"latest_event_id" text NOT NULL,
	"latest_evaluation_id" text NOT NULL,
	"revision" integer NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_alerts_alert_key_unique" UNIQUE("alert_key"),
	CONSTRAINT "operational_alerts_status_check" CHECK ("operational_alerts"."status" in ('open', 'recovered')),
	CONSTRAINT "operational_alerts_severity_check" CHECK ("operational_alerts"."severity" in ('warning', 'error', 'critical')),
	CONSTRAINT "operational_alerts_revision_check" CHECK ("operational_alerts"."revision" > 0),
	CONSTRAINT "operational_alerts_document_check" CHECK (jsonb_typeof("operational_alerts"."document") = 'object')
);
--> statement-breakpoint
CREATE TABLE "operational_event_delivery_commands" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_version" integer DEFAULT 1 NOT NULL,
	"idempotency_key" text NOT NULL,
	"event_id" text NOT NULL,
	"action" text NOT NULL,
	"request_hash" text NOT NULL,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"request" jsonb NOT NULL,
	"result" jsonb,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_event_delivery_commands_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "operational_event_delivery_commands_action_check" CHECK ("operational_event_delivery_commands"."action" = 'requeue_dead_letter'),
	CONSTRAINT "operational_event_delivery_commands_contract_version_check" CHECK ("operational_event_delivery_commands"."contract_version" = 1),
	CONSTRAINT "operational_event_delivery_commands_request_hash_check" CHECK ("operational_event_delivery_commands"."request_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "operational_event_delivery_commands_required_text_check" CHECK (length(btrim("operational_event_delivery_commands"."idempotency_key")) > 0 and length(btrim("operational_event_delivery_commands"."event_id")) > 0 and length(btrim("operational_event_delivery_commands"."actor")) > 0 and length(btrim("operational_event_delivery_commands"."reason")) > 0),
	CONSTRAINT "operational_event_delivery_commands_request_check" CHECK (jsonb_typeof("operational_event_delivery_commands"."request") = 'object'),
	CONSTRAINT "operational_event_delivery_commands_completion_check" CHECK (("operational_event_delivery_commands"."result" is null and "operational_event_delivery_commands"."completed_at" is null) or (jsonb_typeof("operational_event_delivery_commands"."result") = 'object' and "operational_event_delivery_commands"."completed_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "operational_event_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_version" integer NOT NULL,
	"envelope" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"last_error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_event_outbox_status_check" CHECK ("operational_event_outbox"."status" in ('pending', 'delivering', 'delivered', 'dead_letter')),
	CONSTRAINT "operational_event_outbox_contract_version_check" CHECK ("operational_event_outbox"."contract_version" = 1),
	CONSTRAINT "operational_event_outbox_attempts_check" CHECK ("operational_event_outbox"."attempt_count" >= 0 and "operational_event_outbox"."max_attempts" > 0 and "operational_event_outbox"."attempt_count" <= "operational_event_outbox"."max_attempts"),
	CONSTRAINT "operational_event_outbox_envelope_check" CHECK (jsonb_typeof("operational_event_outbox"."envelope") = 'object'),
	CONSTRAINT "operational_event_outbox_lifecycle_check" CHECK ((
        "operational_event_outbox"."status" = 'pending'
        and "operational_event_outbox"."lease_owner" is null
        and "operational_event_outbox"."lease_token" is null
        and "operational_event_outbox"."lease_expires_at" is null
        and "operational_event_outbox"."delivered_at" is null
      ) or (
        "operational_event_outbox"."status" = 'delivering'
        and "operational_event_outbox"."lease_owner" is not null
        and "operational_event_outbox"."lease_token" is not null
        and "operational_event_outbox"."lease_expires_at" is not null
        and "operational_event_outbox"."delivered_at" is null
      ) or (
        "operational_event_outbox"."status" = 'delivered'
        and "operational_event_outbox"."lease_owner" is null
        and "operational_event_outbox"."lease_token" is null
        and "operational_event_outbox"."lease_expires_at" is null
        and "operational_event_outbox"."delivered_at" is not null
      ) or (
        "operational_event_outbox"."status" = 'dead_letter'
        and "operational_event_outbox"."lease_owner" is null
        and "operational_event_outbox"."lease_token" is null
        and "operational_event_outbox"."lease_expires_at" is null
        and "operational_event_outbox"."delivered_at" is null
        and "operational_event_outbox"."last_error" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "operational_events" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_version" integer NOT NULL,
	"kind" text NOT NULL,
	"severity" text NOT NULL,
	"outcome" text NOT NULL,
	"authority" text NOT NULL,
	"service" text NOT NULL,
	"environment" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"envelope" jsonb NOT NULL,
	"stored_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_events_contract_version_check" CHECK ("operational_events"."contract_version" = 1),
	CONSTRAINT "operational_events_envelope_check" CHECK (jsonb_typeof("operational_events"."envelope") = 'object'),
	CONSTRAINT "operational_events_chronology_check" CHECK ("operational_events"."observed_at" >= "operational_events"."occurred_at")
);
--> statement-breakpoint
CREATE TABLE "operational_slo_evaluations" (
	"id" text PRIMARY KEY NOT NULL,
	"slo_id" text NOT NULL,
	"environment" text NOT NULL,
	"status" text NOT NULL,
	"trigger_event_id" text NOT NULL,
	"document" jsonb NOT NULL,
	"evaluated_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_slo_evaluations_status_check" CHECK ("operational_slo_evaluations"."status" in ('insufficient_data', 'healthy', 'breaching')),
	CONSTRAINT "operational_slo_evaluations_document_check" CHECK (jsonb_typeof("operational_slo_evaluations"."document") = 'object')
);
--> statement-breakpoint
CREATE TABLE "operational_synthetic_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"check_id" text NOT NULL,
	"environment" text NOT NULL,
	"status" text NOT NULL,
	"event_id" text NOT NULL,
	"document" jsonb NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_synthetic_runs_idempotency_key_unique" UNIQUE("idempotency_key"),
	CONSTRAINT "operational_synthetic_runs_status_check" CHECK ("operational_synthetic_runs"."status" in ('passed', 'failed', 'error')),
	CONSTRAINT "operational_synthetic_runs_document_check" CHECK (jsonb_typeof("operational_synthetic_runs"."document") = 'object'),
	CONSTRAINT "operational_synthetic_runs_chronology_check" CHECK ("operational_synthetic_runs"."completed_at" >= "operational_synthetic_runs"."started_at")
);
--> statement-breakpoint
ALTER TABLE "operational_alerts" ADD CONSTRAINT "operational_alerts_latest_event_id_operational_event_outbox_id_fk" FOREIGN KEY ("latest_event_id") REFERENCES "public"."operational_event_outbox"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_alerts" ADD CONSTRAINT "operational_alerts_latest_evaluation_id_operational_slo_evaluations_id_fk" FOREIGN KEY ("latest_evaluation_id") REFERENCES "public"."operational_slo_evaluations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_event_delivery_commands" ADD CONSTRAINT "operational_event_delivery_commands_event_id_operational_event_outbox_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."operational_event_outbox"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_slo_evaluations" ADD CONSTRAINT "operational_slo_evaluations_trigger_event_id_operational_event_outbox_id_fk" FOREIGN KEY ("trigger_event_id") REFERENCES "public"."operational_event_outbox"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_synthetic_runs" ADD CONSTRAINT "operational_synthetic_runs_event_id_operational_event_outbox_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."operational_event_outbox"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "operational_alerts_status_severity_idx" ON "operational_alerts" USING btree ("status","severity","updated_at");--> statement-breakpoint
CREATE INDEX "operational_alerts_policy_idx" ON "operational_alerts" USING btree ("policy_id","environment");--> statement-breakpoint
CREATE INDEX "operational_event_delivery_commands_event_time_idx" ON "operational_event_delivery_commands" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "operational_event_outbox_delivery_queue_idx" ON "operational_event_outbox" USING btree ("status","available_at","created_at") WHERE "operational_event_outbox"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "operational_event_outbox_lease_expiry_idx" ON "operational_event_outbox" USING btree ("lease_expires_at") WHERE "operational_event_outbox"."status" = 'delivering';--> statement-breakpoint
CREATE INDEX "operational_events_kind_time_idx" ON "operational_events" USING btree ("kind","occurred_at");--> statement-breakpoint
CREATE INDEX "operational_events_service_time_idx" ON "operational_events" USING btree ("environment","service","occurred_at");--> statement-breakpoint
CREATE INDEX "operational_events_subject_time_idx" ON "operational_events" USING btree ("subject_type","subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX "operational_events_correlation_idx" ON "operational_events" USING btree ("correlation_id","occurred_at");--> statement-breakpoint
CREATE INDEX "operational_slo_evaluations_slo_time_idx" ON "operational_slo_evaluations" USING btree ("slo_id","environment","evaluated_at");--> statement-breakpoint
CREATE INDEX "operational_synthetic_runs_check_time_idx" ON "operational_synthetic_runs" USING btree ("check_id","environment","completed_at");