CREATE TABLE "operational_alert_issue_projections" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_version" integer DEFAULT 1 NOT NULL,
	"alert_key" text NOT NULL,
	"repository" text NOT NULL,
	"target_alert_revision" integer NOT NULL,
	"target_alert" jsonb NOT NULL,
	"projected_alert_revision" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 8 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_owner" text,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"issue_number" integer,
	"issue_url" text,
	"issue_state" text,
	"managed_body_hash" text,
	"projected_at" timestamp with time zone,
	"last_error" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_alert_issue_projections_status_check" CHECK ("operational_alert_issue_projections"."status" in ('pending', 'delivering', 'delivered', 'dead_letter')),
	CONSTRAINT "operational_alert_issue_projections_issue_state_check" CHECK ("operational_alert_issue_projections"."issue_state" is null or "operational_alert_issue_projections"."issue_state" in ('open', 'closed')),
	CONSTRAINT "operational_alert_issue_projections_contract_version_check" CHECK ("operational_alert_issue_projections"."contract_version" = 1),
	CONSTRAINT "operational_alert_issue_projections_revision_check" CHECK ("operational_alert_issue_projections"."target_alert_revision" > 0 and "operational_alert_issue_projections"."projected_alert_revision" >= 0 and "operational_alert_issue_projections"."projected_alert_revision" <= "operational_alert_issue_projections"."target_alert_revision"),
	CONSTRAINT "operational_alert_issue_projections_target_alert_check" CHECK (jsonb_typeof("operational_alert_issue_projections"."target_alert") = 'object'),
	CONSTRAINT "operational_alert_issue_projections_attempts_check" CHECK ("operational_alert_issue_projections"."attempt_count" >= 0 and "operational_alert_issue_projections"."max_attempts" > 0 and "operational_alert_issue_projections"."attempt_count" <= "operational_alert_issue_projections"."max_attempts"),
	CONSTRAINT "operational_alert_issue_projections_issue_identity_check" CHECK ((
          "operational_alert_issue_projections"."issue_number" is null
          and "operational_alert_issue_projections"."issue_url" is null
          and "operational_alert_issue_projections"."issue_state" is null
        ) or (
          "operational_alert_issue_projections"."issue_number" > 0
          and length(btrim("operational_alert_issue_projections"."issue_url")) > 0
          and "operational_alert_issue_projections"."issue_state" is not null
        )),
	CONSTRAINT "operational_alert_issue_projections_lifecycle_check" CHECK ((
          "operational_alert_issue_projections"."status" = 'pending'
          and "operational_alert_issue_projections"."lease_owner" is null
          and "operational_alert_issue_projections"."lease_token" is null
          and "operational_alert_issue_projections"."lease_expires_at" is null
        ) or (
          "operational_alert_issue_projections"."status" = 'delivering'
          and "operational_alert_issue_projections"."lease_owner" is not null
          and "operational_alert_issue_projections"."lease_token" is not null
          and "operational_alert_issue_projections"."lease_expires_at" is not null
        ) or (
          "operational_alert_issue_projections"."status" = 'delivered'
          and "operational_alert_issue_projections"."lease_owner" is null
          and "operational_alert_issue_projections"."lease_token" is null
          and "operational_alert_issue_projections"."lease_expires_at" is null
          and "operational_alert_issue_projections"."projected_alert_revision" = "operational_alert_issue_projections"."target_alert_revision"
          and "operational_alert_issue_projections"."issue_number" is not null
          and "operational_alert_issue_projections"."managed_body_hash" is not null
          and "operational_alert_issue_projections"."projected_at" is not null
          and "operational_alert_issue_projections"."last_error" is null
        ) or (
          "operational_alert_issue_projections"."status" = 'dead_letter'
          and "operational_alert_issue_projections"."lease_owner" is null
          and "operational_alert_issue_projections"."lease_token" is null
          and "operational_alert_issue_projections"."lease_expires_at" is null
          and "operational_alert_issue_projections"."last_error" is not null
        ))
);
--> statement-breakpoint
ALTER TABLE "operational_alert_issue_projections" ADD CONSTRAINT "operational_alert_issue_projection_alert_fk" FOREIGN KEY ("alert_key") REFERENCES "public"."operational_alerts"("alert_key") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "operational_alert_issue_projections_alert_repository_idx" ON "operational_alert_issue_projections" USING btree ("alert_key","repository");--> statement-breakpoint
CREATE INDEX "operational_alert_issue_projections_delivery_queue_idx" ON "operational_alert_issue_projections" USING btree ("status","available_at","created_at") WHERE "operational_alert_issue_projections"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "operational_alert_issue_projections_lease_expiry_idx" ON "operational_alert_issue_projections" USING btree ("lease_expires_at") WHERE "operational_alert_issue_projections"."status" = 'delivering';
