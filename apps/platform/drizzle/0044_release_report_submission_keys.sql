-- airjam:migration-mode=online
-- airjam:verify=index:game_release_reports_submission_id_idx
-- Private retry keys are separate from creator-visible report IDs. Existing
-- reports receive unguessable keys, not aliases of their public IDs. This
-- additive column permits the prior app to overlap; the migration runner's
-- lock/statement bounds still apply to the table rewrite and index build.
ALTER TABLE "game_release_reports" ADD COLUMN "submission_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "game_release_reports_submission_id_idx" ON "game_release_reports" USING btree ("submission_id");
