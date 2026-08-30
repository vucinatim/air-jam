ALTER TABLE "operational_job_attempts" DROP CONSTRAINT "operational_job_attempts_required_text_check";--> statement-breakpoint
ALTER TABLE "operational_jobs" DROP CONSTRAINT "operational_jobs_kind_check";--> statement-breakpoint
ALTER TABLE "operational_jobs" DROP CONSTRAINT "operational_jobs_required_text_check";--> statement-breakpoint
ALTER TABLE "operational_jobs" DROP CONSTRAINT "operational_jobs_kind_lane_check";--> statement-breakpoint
ALTER TABLE "game_release_checks" DROP CONSTRAINT "game_release_checks_job_attempt_generation_fk";
--> statement-breakpoint
ALTER TABLE "operational_jobs" DROP CONSTRAINT "operational_jobs_replay_of_fk";
--> statement-breakpoint
DROP INDEX "operational_job_attempts_job_attempt_idx";--> statement-breakpoint
DROP INDEX "operational_jobs_active_resource_idx";--> statement-breakpoint
ALTER TABLE "operational_job_attempts" ALTER COLUMN "release_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "operational_job_attempts" ALTER COLUMN "generation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "operational_jobs" ALTER COLUMN "release_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "operational_jobs" ALTER COLUMN "generation_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "game_media_assets" ADD COLUMN "storage_cleanup_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_media_assets" ADD COLUMN "storage_deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_release_generations" ADD COLUMN "storage_cleanup_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "game_release_generations" ADD COLUMN "storage_deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD COLUMN "resource_kind" text;--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD COLUMN "resource_id" text;--> statement-breakpoint
UPDATE "operational_jobs"
SET
  "resource_kind" = 'release_generation',
  "resource_id" = "generation_id"
WHERE "resource_kind" IS NULL OR "resource_id" IS NULL;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "operational_jobs"
    WHERE "resource_kind" IS NULL OR "resource_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot migrate operational jobs without release-generation resource identity';
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "operational_jobs" ALTER COLUMN "resource_kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "operational_jobs" ALTER COLUMN "resource_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "operational_job_attempts" ADD CONSTRAINT "operational_job_attempts_job_id_operational_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."operational_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_replay_of_fk" FOREIGN KEY ("replay_of_job_id") REFERENCES "public"."operational_jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_media_assets_cleanup_idx" ON "game_media_assets" USING btree ("status","updated_at") WHERE "game_media_assets"."storage_deleted_at" is null and "game_media_assets"."status" in ('uploading', 'failed', 'archived');--> statement-breakpoint
CREATE INDEX "game_release_generations_cleanup_idx" ON "game_release_generations" USING btree ("status","created_at") WHERE "game_release_generations"."storage_deleted_at" is null and "game_release_generations"."status" in ('failed', 'abandoned');--> statement-breakpoint
CREATE UNIQUE INDEX "operational_job_attempts_job_attempt_idx" ON "operational_job_attempts" USING btree ("job_id","attempt");--> statement-breakpoint
ALTER TABLE "game_release_checks" ADD CONSTRAINT "game_release_checks_job_attempt_generation_fk" FOREIGN KEY ("job_id","job_attempt") REFERENCES "public"."operational_job_attempts"("job_id","attempt") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "operational_jobs_active_resource_idx" ON "operational_jobs" USING btree ("kind","resource_kind","resource_id") WHERE "operational_jobs"."status" in ('queued', 'running', 'cancel_requested');--> statement-breakpoint
ALTER TABLE "game_media_assets" ADD CONSTRAINT "game_media_assets_storage_cleanup_check" CHECK (("game_media_assets"."storage_cleanup_started_at" is null and "game_media_assets"."storage_deleted_at" is null) or ("game_media_assets"."storage_cleanup_started_at" is not null and "game_media_assets"."status" in ('failed', 'archived') and ("game_media_assets"."storage_deleted_at" is null or "game_media_assets"."storage_deleted_at" >= "game_media_assets"."storage_cleanup_started_at")));--> statement-breakpoint
ALTER TABLE "game_release_generations" ADD CONSTRAINT "game_release_generations_storage_cleanup_check" CHECK (("game_release_generations"."storage_cleanup_started_at" is null and "game_release_generations"."storage_deleted_at" is null) or ("game_release_generations"."storage_cleanup_started_at" is not null and "game_release_generations"."status" in ('failed', 'abandoned') and ("game_release_generations"."storage_deleted_at" is null or "game_release_generations"."storage_deleted_at" >= "game_release_generations"."storage_cleanup_started_at")));--> statement-breakpoint
ALTER TABLE "operational_job_attempts" ADD CONSTRAINT "operational_job_attempts_required_text_check" CHECK (btrim("operational_job_attempts"."id") <> '' and btrim("operational_job_attempts"."job_id") <> '' and ("operational_job_attempts"."release_id" is null or btrim("operational_job_attempts"."release_id") <> '') and ("operational_job_attempts"."generation_id" is null or btrim("operational_job_attempts"."generation_id") <> '') and btrim("operational_job_attempts"."lease_owner") <> '' and btrim("operational_job_attempts"."lease_token") <> '');--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_resource_kind_check" CHECK ("operational_jobs"."resource_kind" in ('release_generation', 'game_media_asset'));--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_resource_scope_check" CHECK ((
        "operational_jobs"."resource_kind" = 'release_generation'
        and "operational_jobs"."release_id" is not null
        and "operational_jobs"."generation_id" is not null
        and "operational_jobs"."resource_id" = "operational_jobs"."generation_id"
      ) or (
        "operational_jobs"."kind" = 'lifecycle_cleanup'
        and "operational_jobs"."resource_kind" = 'game_media_asset'
        and "operational_jobs"."release_id" is null
        and "operational_jobs"."generation_id" is null
      ));--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_kind_check" CHECK ("operational_jobs"."kind" in ('release_artifact_processing', 'release_browser_validation', 'release_image_moderation', 'lifecycle_cleanup'));--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_required_text_check" CHECK (btrim("operational_jobs"."id") <> '' and btrim("operational_jobs"."creator_id") <> '' and btrim("operational_jobs"."game_id") <> '' and ("operational_jobs"."release_id" is null or btrim("operational_jobs"."release_id") <> '') and ("operational_jobs"."generation_id" is null or btrim("operational_jobs"."generation_id") <> '') and btrim("operational_jobs"."resource_kind") <> '' and btrim("operational_jobs"."resource_id") <> '' and btrim("operational_jobs"."created_by_command_id") <> '' and btrim("operational_jobs"."correlation_id") <> '');--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_kind_lane_check" CHECK (("operational_jobs"."kind" = 'release_artifact_processing' and "operational_jobs"."lane" = 'release_processing') or ("operational_jobs"."kind" = 'release_browser_validation' and "operational_jobs"."lane" = 'browser_validation') or ("operational_jobs"."kind" = 'release_image_moderation' and "operational_jobs"."lane" = 'moderation') or ("operational_jobs"."kind" = 'lifecycle_cleanup' and "operational_jobs"."lane" = 'lifecycle_cleanup'));
