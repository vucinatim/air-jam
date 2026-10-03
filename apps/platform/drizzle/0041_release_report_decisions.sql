-- airjam:migration-mode=online
-- airjam:verify=table:game_release_report_decisions
-- airjam:verify=index:game_release_report_decisions_revision_idx
-- airjam:verify=index:game_release_report_decisions_command_idx
-- airjam:verify=constraint:game_release_report_decisions.game_release_report_decisions_revision_check
-- airjam:verify=constraint:game_release_report_decisions.game_release_report_decisions_status_check
-- Additive decision history and a defaulted revision permit the prior app to
-- keep receiving reports during rollout. No existing report is rewritten.
CREATE TABLE "game_release_report_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"revision" integer NOT NULL,
	"status" text NOT NULL,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_release_report_decisions_revision_check" CHECK ("game_release_report_decisions"."revision" > 0),
	CONSTRAINT "game_release_report_decisions_status_check" CHECK ("game_release_report_decisions"."status" in ('open', 'reviewed', 'dismissed'))
);
--> statement-breakpoint
ALTER TABLE "game_release_reports" ADD COLUMN "review_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_release_report_decisions" ADD CONSTRAINT "game_release_report_decisions_report_id_game_release_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."game_release_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_release_report_decisions_revision_idx" ON "game_release_report_decisions" USING btree ("report_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "game_release_report_decisions_command_idx" ON "game_release_report_decisions" USING btree ("report_id","idempotency_key");
