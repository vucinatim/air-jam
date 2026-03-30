ALTER TABLE "games" ADD COLUMN "arcade_visibility" text DEFAULT 'hidden';

UPDATE "games"
SET "arcade_visibility" = CASE
  WHEN "is_published" = true THEN 'listed'
  ELSE 'hidden'
END;

ALTER TABLE "games" ALTER COLUMN "arcade_visibility" SET NOT NULL;
ALTER TABLE "games" ALTER COLUMN "arcade_visibility" SET DEFAULT 'hidden';
ALTER TABLE "games" DROP COLUMN "is_published";
