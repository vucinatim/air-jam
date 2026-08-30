WITH "ranked_live_releases" AS (
	SELECT
		"id",
		row_number() OVER (
			PARTITION BY "game_id"
			ORDER BY "published_at" DESC NULLS LAST, "created_at" DESC, "id" DESC
		) AS "live_rank"
	FROM "game_releases"
	WHERE "status" = 'live'
)
UPDATE "game_releases"
SET
	"status" = 'archived',
	"archived_at" = coalesce("archived_at", now())
FROM "ranked_live_releases"
WHERE
	"game_releases"."id" = "ranked_live_releases"."id"
	AND "ranked_live_releases"."live_rank" > 1;
--> statement-breakpoint
CREATE UNIQUE INDEX "game_releases_one_live_per_game_idx" ON "game_releases" USING btree ("game_id") WHERE "game_releases"."status" = 'live';
