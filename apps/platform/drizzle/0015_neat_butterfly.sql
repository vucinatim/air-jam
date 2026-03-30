CREATE TABLE "game_media_assets" (
  "id" text PRIMARY KEY NOT NULL,
  "game_id" text NOT NULL,
  "kind" text NOT NULL,
  "status" text NOT NULL,
  "original_filename" text NOT NULL,
  "mime_type" text NOT NULL,
  "size_bytes" integer NOT NULL,
  "checksum" text,
  "storage_key" text NOT NULL,
  "width" integer,
  "height" integer,
  "duration_seconds" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "game_media_assets_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "game_media_assets"
  ADD CONSTRAINT "game_media_assets_game_id_games_id_fk"
  FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "games"
  ADD COLUMN "thumbnail_media_asset_id" text;
--> statement-breakpoint
ALTER TABLE "games"
  ADD COLUMN "cover_media_asset_id" text;
--> statement-breakpoint
ALTER TABLE "games"
  ADD COLUMN "preview_video_media_asset_id" text;
--> statement-breakpoint
CREATE INDEX "game_media_assets_game_id_idx" ON "game_media_assets" USING btree ("game_id");
--> statement-breakpoint
CREATE INDEX "game_media_assets_kind_idx" ON "game_media_assets" USING btree ("kind");
--> statement-breakpoint
CREATE INDEX "game_media_assets_status_idx" ON "game_media_assets" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "game_media_assets_created_at_idx" ON "game_media_assets" USING btree ("created_at");
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "thumbnail_url";
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "video_url";
--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "cover_url";
