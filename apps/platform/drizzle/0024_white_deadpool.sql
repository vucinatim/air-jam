CREATE TABLE "operational_budget_cycles" (
	"id" text PRIMARY KEY NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"profile" text NOT NULL,
	"normal_target_microusd" bigint NOT NULL,
	"warning_microusd" bigint NOT NULL,
	"protection_microusd" bigint NOT NULL,
	"near_ceiling_microusd" bigint NOT NULL,
	"ceiling_microusd" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_budget_cycles_period_check" CHECK ("operational_budget_cycles"."period_end" > "operational_budget_cycles"."period_start"),
	CONSTRAINT "operational_budget_cycles_id_check" CHECK (length(btrim("operational_budget_cycles"."id")) > 0),
	CONSTRAINT "operational_budget_cycles_profile_check" CHECK ("operational_budget_cycles"."profile" in ('ordinary', 'launch_1_0')),
	CONSTRAINT "operational_budget_cycles_thresholds_check" CHECK ("operational_budget_cycles"."normal_target_microusd" > 0 and "operational_budget_cycles"."warning_microusd" > "operational_budget_cycles"."normal_target_microusd" and "operational_budget_cycles"."protection_microusd" > "operational_budget_cycles"."warning_microusd" and "operational_budget_cycles"."near_ceiling_microusd" > "operational_budget_cycles"."protection_microusd" and "operational_budget_cycles"."ceiling_microusd" > "operational_budget_cycles"."near_ceiling_microusd")
);
--> statement-breakpoint
CREATE TABLE "operational_budget_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"idempotency_key" text NOT NULL,
	"cycle_id" text NOT NULL,
	"contract_version" integer NOT NULL,
	"provider" text NOT NULL,
	"scope_kind" text NOT NULL,
	"scope_id" text NOT NULL,
	"scope_name" text NOT NULL,
	"scope_metadata" jsonb NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"actual_amount_microusd" bigint NOT NULL,
	"projected_amount_microusd" bigint,
	"measurements" jsonb NOT NULL,
	"cost_breakdown_microusd" jsonb NOT NULL,
	"rate_card" jsonb NOT NULL,
	"source_version" text NOT NULL,
	"collected_by" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_budget_evidence_currency_check" CHECK ("operational_budget_evidence"."currency" = 'USD'),
	CONSTRAINT "operational_budget_evidence_contract_version_check" CHECK ("operational_budget_evidence"."contract_version" = 1),
	CONSTRAINT "operational_budget_evidence_required_text_check" CHECK (length(btrim("operational_budget_evidence"."id")) > 0 and length(btrim("operational_budget_evidence"."idempotency_key")) > 0 and length(btrim("operational_budget_evidence"."provider")) > 0 and length(btrim("operational_budget_evidence"."scope_kind")) > 0 and length(btrim("operational_budget_evidence"."scope_id")) > 0 and length(btrim("operational_budget_evidence"."scope_name")) > 0 and length(btrim("operational_budget_evidence"."source_version")) > 0 and length(btrim("operational_budget_evidence"."collected_by")) > 0 and length(btrim("operational_budget_evidence"."reason")) > 0),
	CONSTRAINT "operational_budget_evidence_json_objects_check" CHECK (jsonb_typeof("operational_budget_evidence"."scope_metadata") = 'object' and jsonb_typeof("operational_budget_evidence"."measurements") = 'object' and jsonb_typeof("operational_budget_evidence"."cost_breakdown_microusd") = 'object' and jsonb_typeof("operational_budget_evidence"."rate_card") = 'object'),
	CONSTRAINT "operational_budget_evidence_actual_amount_check" CHECK ("operational_budget_evidence"."actual_amount_microusd" >= 0),
	CONSTRAINT "operational_budget_evidence_projected_amount_check" CHECK ("operational_budget_evidence"."projected_amount_microusd" is null or "operational_budget_evidence"."projected_amount_microusd" >= 0)
);
--> statement-breakpoint
ALTER TABLE "operational_budget_evidence" ADD CONSTRAINT "operational_budget_evidence_cycle_id_operational_budget_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."operational_budget_cycles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "operational_budget_cycles_period_uidx" ON "operational_budget_cycles" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "operational_budget_evidence_idempotency_key_uidx" ON "operational_budget_evidence" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "operational_budget_evidence_cycle_observed_at_idx" ON "operational_budget_evidence" USING btree ("cycle_id","observed_at");--> statement-breakpoint
CREATE INDEX "operational_budget_evidence_source_observed_at_idx" ON "operational_budget_evidence" USING btree ("provider","scope_kind","scope_id","observed_at");