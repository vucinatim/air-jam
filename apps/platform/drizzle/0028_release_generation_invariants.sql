ALTER TABLE "game_release_generations" DROP CONSTRAINT "game_release_generations_required_text_check";--> statement-breakpoint
ALTER TABLE "game_release_checks" DROP CONSTRAINT "game_release_checks_generation_release_scope_fk";
--> statement-breakpoint
ALTER TABLE "game_release_checks" ADD CONSTRAINT "game_release_checks_generation_release_scope_fk" FOREIGN KEY ("generation_id","release_id") REFERENCES "public"."game_release_generations"("id","release_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_release_generations_one_active_per_release_idx" ON "game_release_generations" USING btree ("release_id") WHERE "game_release_generations"."status" in ('awaiting_upload', 'processing');--> statement-breakpoint
ALTER TABLE "game_release_generations" ADD CONSTRAINT "game_release_generations_required_text_check" CHECK (btrim("game_release_generations"."id") <> '' and btrim("game_release_generations"."release_id") <> '' and btrim("game_release_generations"."original_filename") <> '' and btrim("game_release_generations"."content_type") <> '' and btrim("game_release_generations"."zip_object_key") <> '' and ("game_release_generations"."observed_content_type" is null or btrim("game_release_generations"."observed_content_type") <> '') and ("game_release_generations"."observed_etag" is null or btrim("game_release_generations"."observed_etag") <> '') and ("game_release_generations"."site_root_key" is null or btrim("game_release_generations"."site_root_key") <> '') and ("game_release_generations"."entry_path" is null or btrim("game_release_generations"."entry_path") <> ''));--> statement-breakpoint
CREATE FUNCTION "enforce_game_release_generation_state"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
	target_release_id text;
BEGIN
	IF TG_TABLE_NAME = 'game_releases' THEN
		target_release_id := coalesce(NEW."id", OLD."id");
	ELSE
		target_release_id := coalesce(NEW."release_id", OLD."release_id");
	END IF;

	IF EXISTS (
		SELECT 1
		FROM "game_releases" release
		LEFT JOIN "game_release_generations" candidate
			ON candidate."id" = release."candidate_generation_id"
			AND candidate."release_id" = release."id"
		LEFT JOIN "game_release_generations" promoted
			ON promoted."id" = release."promoted_generation_id"
			AND promoted."release_id" = release."id"
		WHERE release."id" = target_release_id
			AND (
				(
					release."candidate_generation_id" IS NOT NULL
					AND (
						candidate."id" IS NULL
						OR (release."status" = 'uploading' AND candidate."status" <> 'awaiting_upload')
						OR (release."status" = 'checking' AND candidate."status" NOT IN ('processing', 'ready'))
						OR release."status" NOT IN ('uploading', 'checking')
					)
				)
				OR (
					release."promoted_generation_id" IS NOT NULL
					AND (promoted."id" IS NULL OR promoted."status" <> 'ready')
				)
				OR (release."status" = 'draft' AND (release."candidate_generation_id" IS NOT NULL OR release."promoted_generation_id" IS NOT NULL))
				OR (release."status" IN ('uploading', 'checking') AND release."candidate_generation_id" IS NULL)
				OR (release."status" IN ('ready', 'live', 'quarantined') AND (release."candidate_generation_id" IS NOT NULL OR release."promoted_generation_id" IS NULL))
				OR (release."status" IN ('failed', 'archived') AND release."candidate_generation_id" IS NOT NULL)
				OR EXISTS (
					SELECT 1
					FROM "game_release_generations" active_generation
					WHERE active_generation."release_id" = release."id"
						AND active_generation."status" IN ('awaiting_upload', 'processing')
						AND active_generation."id" IS DISTINCT FROM release."candidate_generation_id"
				)
				OR (
					release."status" = 'checking'
					AND candidate."status" = 'ready'
					AND release."promoted_generation_id" IS DISTINCT FROM release."candidate_generation_id"
				)
			)
	) THEN
		RAISE EXCEPTION 'Release % has generation pointers incompatible with its lifecycle state', target_release_id
			USING ERRCODE = '23514', CONSTRAINT = 'game_release_generation_state_guard';
	END IF;

	RETURN NULL;
END
$$;--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "game_releases_generation_state_guard"
AFTER INSERT OR UPDATE OR DELETE ON "game_releases"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_game_release_generation_state"();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "game_release_generations_release_state_guard"
AFTER INSERT OR UPDATE OR DELETE ON "game_release_generations"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "enforce_game_release_generation_state"();
