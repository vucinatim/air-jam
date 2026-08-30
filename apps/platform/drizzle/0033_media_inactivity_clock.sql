DROP INDEX "game_media_assets_cleanup_idx";--> statement-breakpoint
ALTER TABLE "game_media_assets" ADD COLUMN "inactive_at" timestamp with time zone;--> statement-breakpoint
UPDATE "game_media_assets"
SET "inactive_at" = "updated_at" AT TIME ZONE 'UTC'
WHERE "status" IN ('failed', 'archived');--> statement-breakpoint
CREATE INDEX "game_media_assets_cleanup_idx" ON "game_media_assets" USING btree ("status","inactive_at","created_at") WHERE "game_media_assets"."storage_deleted_at" is null and "game_media_assets"."status" in ('uploading', 'failed', 'archived');--> statement-breakpoint
ALTER TABLE "game_media_assets" ADD CONSTRAINT "game_media_assets_inactive_at_check" CHECK (("game_media_assets"."status" in ('failed', 'archived') and "game_media_assets"."inactive_at" is not null) or ("game_media_assets"."status" in ('uploading', 'ready') and "game_media_assets"."inactive_at" is null));
