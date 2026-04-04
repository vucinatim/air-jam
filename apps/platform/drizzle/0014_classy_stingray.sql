UPDATE "games"
SET
  "arcade_visibility" = 'hidden',
  "updated_at" = now()
WHERE "arcade_visibility" = 'listed'
  AND NOT EXISTS (
    SELECT 1
    FROM "game_releases"
    WHERE "game_releases"."game_id" = "games"."id"
      AND "game_releases"."status" = 'live'
  );
