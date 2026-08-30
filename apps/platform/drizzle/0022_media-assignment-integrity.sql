CREATE TABLE "game_media_assignments" (
	"game_id" text NOT NULL,
	"kind" text NOT NULL,
	"asset_id" text NOT NULL,
	"asset_status" text DEFAULT 'ready' NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_media_assignments_game_id_kind_pk" PRIMARY KEY("game_id","kind"),
	CONSTRAINT "game_media_assignments_ready_asset_check" CHECK ("game_media_assignments"."asset_status" = 'ready')
);
--> statement-breakpoint
ALTER TABLE "game_media_assignments" ADD CONSTRAINT "game_media_assignments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_media_assets_assignment_target_idx" ON "game_media_assets" USING btree ("id","game_id","kind","status");--> statement-breakpoint
ALTER TABLE "game_media_assignments" ADD CONSTRAINT "game_media_assignments_asset_integrity_fk" FOREIGN KEY ("asset_id","game_id","kind","asset_status") REFERENCES "public"."game_media_assets"("id","game_id","kind","status") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_media_assignments_asset_id_idx" ON "game_media_assignments" USING btree ("asset_id");--> statement-breakpoint
INSERT INTO "game_media_assignments" ("game_id", "kind", "asset_id", "asset_status")
SELECT "games"."id", 'thumbnail', "assets"."id", 'ready'
FROM "games"
INNER JOIN "game_media_assets" AS "assets"
	ON "assets"."id" = "games"."thumbnail_media_asset_id"
	AND "assets"."game_id" = "games"."id"
	AND "assets"."kind" = 'thumbnail'
	AND "assets"."status" = 'ready'
WHERE "games"."thumbnail_media_asset_id" IS NOT NULL
UNION ALL
SELECT "games"."id", 'cover', "assets"."id", 'ready'
FROM "games"
INNER JOIN "game_media_assets" AS "assets"
	ON "assets"."id" = "games"."cover_media_asset_id"
	AND "assets"."game_id" = "games"."id"
	AND "assets"."kind" = 'cover'
	AND "assets"."status" = 'ready'
WHERE "games"."cover_media_asset_id" IS NOT NULL
UNION ALL
SELECT "games"."id", 'preview_video', "assets"."id", 'ready'
FROM "games"
INNER JOIN "game_media_assets" AS "assets"
	ON "assets"."id" = "games"."preview_video_media_asset_id"
	AND "assets"."game_id" = "games"."id"
	AND "assets"."kind" = 'preview_video'
	AND "assets"."status" = 'ready'
WHERE "games"."preview_video_media_asset_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "thumbnail_media_asset_id";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "cover_media_asset_id";--> statement-breakpoint
ALTER TABLE "games" DROP COLUMN "preview_video_media_asset_id";
