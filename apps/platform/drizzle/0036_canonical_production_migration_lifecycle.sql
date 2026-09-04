-- airjam:migration-mode=online
-- airjam:verify=table:platform_schema_migration_runs
-- airjam:verify=constraint:platform_schema_migration_runs.platform_schema_migration_runs_lifecycle_check
-- airjam:verify=index:platform_schema_migration_runs_plan_digest_uidx
CREATE TABLE "platform_schema_migration_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_version" integer DEFAULT 1 NOT NULL,
	"plan_digest" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"target_fingerprint" text NOT NULL,
	"source_commit" text NOT NULL,
	"source_head_tag" text NOT NULL,
	"source_head_created_at" bigint NOT NULL,
	"source_head_hash" text NOT NULL,
	"status" text NOT NULL,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"plan" jsonb NOT NULL,
	"backup_evidence" jsonb NOT NULL,
	"drain_evidence" jsonb NOT NULL,
	"verification" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_schema_migration_runs_contract_version_check" CHECK ("platform_schema_migration_runs"."contract_version" = 1),
	CONSTRAINT "platform_schema_migration_runs_status_check" CHECK ("platform_schema_migration_runs"."status" in ('applying', 'applied', 'apply_failed', 'verified', 'verification_failed')),
	CONSTRAINT "platform_schema_migration_runs_digest_check" CHECK ("platform_schema_migration_runs"."plan_digest" ~ '^[a-f0-9]{64}$' and "platform_schema_migration_runs"."source_head_hash" ~ '^[a-f0-9]{64}$'),
	CONSTRAINT "platform_schema_migration_runs_required_text_check" CHECK (length(btrim("platform_schema_migration_runs"."idempotency_key")) > 0 and length(btrim("platform_schema_migration_runs"."target_fingerprint")) > 0 and length(btrim("platform_schema_migration_runs"."source_commit")) > 0 and length(btrim("platform_schema_migration_runs"."source_head_tag")) > 0 and length(btrim("platform_schema_migration_runs"."actor")) > 0 and length(btrim("platform_schema_migration_runs"."reason")) > 0),
	CONSTRAINT "platform_schema_migration_runs_documents_check" CHECK (jsonb_typeof("platform_schema_migration_runs"."plan") = 'object' and jsonb_typeof("platform_schema_migration_runs"."backup_evidence") = 'object' and jsonb_typeof("platform_schema_migration_runs"."drain_evidence") = 'object' and ("platform_schema_migration_runs"."verification" is null or jsonb_typeof("platform_schema_migration_runs"."verification") = 'object')),
	CONSTRAINT "platform_schema_migration_runs_lifecycle_check" CHECK ((
        "platform_schema_migration_runs"."status" = 'applying'
        and "platform_schema_migration_runs"."applied_at" is null
        and "platform_schema_migration_runs"."completed_at" is null
        and "platform_schema_migration_runs"."verification" is null
      ) or (
        "platform_schema_migration_runs"."status" = 'applied'
        and "platform_schema_migration_runs"."applied_at" is not null
        and "platform_schema_migration_runs"."completed_at" is null
        and "platform_schema_migration_runs"."verification" is null
      ) or (
        "platform_schema_migration_runs"."status" = 'apply_failed'
        and "platform_schema_migration_runs"."applied_at" is null
        and "platform_schema_migration_runs"."completed_at" is not null
        and "platform_schema_migration_runs"."verification" is not null
      ) or (
        "platform_schema_migration_runs"."status" in ('verified', 'verification_failed')
        and "platform_schema_migration_runs"."applied_at" is not null
        and "platform_schema_migration_runs"."completed_at" is not null
        and "platform_schema_migration_runs"."verification" is not null
      ))
);
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_schema_migration_runs_plan_digest_uidx" ON "platform_schema_migration_runs" USING btree ("plan_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_schema_migration_runs_idempotency_key_uidx" ON "platform_schema_migration_runs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "platform_schema_migration_runs_status_updated_at_idx" ON "platform_schema_migration_runs" USING btree ("status","updated_at");
