CREATE TABLE "game_release_generations" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"sequence" integer NOT NULL,
	"status" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"declared_size_bytes" integer NOT NULL,
	"zip_object_key" text NOT NULL,
	"site_root_key" text,
	"observed_size_bytes" integer,
	"observed_content_type" text,
	"observed_etag" text,
	"observed_last_modified_at" timestamp with time zone,
	"extracted_size_bytes" integer,
	"file_count" integer,
	"entry_path" text,
	"content_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"upload_observed_at" timestamp with time zone,
	"processing_started_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"abandoned_at" timestamp with time zone,
	CONSTRAINT "game_release_generations_zip_object_key_unique" UNIQUE("zip_object_key"),
	CONSTRAINT "game_release_generations_site_root_key_unique" UNIQUE("site_root_key"),
	CONSTRAINT "game_release_generations_required_text_check" CHECK (btrim("game_release_generations"."id") <> '' and btrim("game_release_generations"."release_id") <> '' and btrim("game_release_generations"."original_filename") <> '' and btrim("game_release_generations"."content_type") <> '' and btrim("game_release_generations"."zip_object_key") <> ''),
	CONSTRAINT "game_release_generations_sequence_check" CHECK ("game_release_generations"."sequence" > 0),
	CONSTRAINT "game_release_generations_size_check" CHECK ("game_release_generations"."declared_size_bytes" > 0 and ("game_release_generations"."observed_size_bytes" is null or "game_release_generations"."observed_size_bytes" > 0) and ("game_release_generations"."extracted_size_bytes" is null or "game_release_generations"."extracted_size_bytes" >= 0) and ("game_release_generations"."file_count" is null or "game_release_generations"."file_count" > 0)),
	CONSTRAINT "game_release_generations_status_check" CHECK ("game_release_generations"."status" in ('awaiting_upload', 'processing', 'ready', 'failed', 'abandoned')),
	CONSTRAINT "game_release_generations_observed_facts_check" CHECK (("game_release_generations"."upload_observed_at" is null and "game_release_generations"."observed_size_bytes" is null and "game_release_generations"."observed_content_type" is null) or ("game_release_generations"."upload_observed_at" is not null and "game_release_generations"."observed_size_bytes" is not null and "game_release_generations"."observed_content_type" is not null)),
	CONSTRAINT "game_release_generations_output_facts_check" CHECK (("game_release_generations"."site_root_key" is null and "game_release_generations"."extracted_size_bytes" is null and "game_release_generations"."file_count" is null and "game_release_generations"."entry_path" is null and "game_release_generations"."content_hash" is null) or ("game_release_generations"."site_root_key" is not null and "game_release_generations"."extracted_size_bytes" is not null and "game_release_generations"."file_count" is not null and "game_release_generations"."entry_path" is not null and "game_release_generations"."content_hash" ~ '^[0-9a-f]{64}$')),
	CONSTRAINT "game_release_generations_lifecycle_check" CHECK ((
        "game_release_generations"."status" = 'awaiting_upload'
        and "game_release_generations"."upload_observed_at" is null
        and "game_release_generations"."processing_started_at" is null
        and "game_release_generations"."ready_at" is null
        and "game_release_generations"."failed_at" is null
        and "game_release_generations"."abandoned_at" is null
        and "game_release_generations"."site_root_key" is null
      ) or (
        "game_release_generations"."status" = 'processing'
        and "game_release_generations"."upload_observed_at" is not null
        and "game_release_generations"."processing_started_at" is not null
        and "game_release_generations"."ready_at" is null
        and "game_release_generations"."failed_at" is null
        and "game_release_generations"."abandoned_at" is null
        and "game_release_generations"."site_root_key" is null
      ) or (
        "game_release_generations"."status" = 'ready'
        and "game_release_generations"."upload_observed_at" is not null
        and "game_release_generations"."processing_started_at" is not null
        and "game_release_generations"."ready_at" is not null
        and "game_release_generations"."failed_at" is null
        and "game_release_generations"."abandoned_at" is null
        and "game_release_generations"."site_root_key" is not null
      ) or (
        "game_release_generations"."status" = 'failed'
        and "game_release_generations"."ready_at" is null
        and "game_release_generations"."failed_at" is not null
        and "game_release_generations"."abandoned_at" is null
        and "game_release_generations"."site_root_key" is null
      ) or (
        "game_release_generations"."status" = 'abandoned'
        and "game_release_generations"."ready_at" is null
        and "game_release_generations"."failed_at" is null
        and "game_release_generations"."abandoned_at" is not null
        and "game_release_generations"."site_root_key" is null
      ))
);
--> statement-breakpoint
ALTER TABLE "game_release_checks" ADD COLUMN "generation_id" text;--> statement-breakpoint
ALTER TABLE "game_releases" ADD COLUMN "candidate_generation_id" text;--> statement-breakpoint
ALTER TABLE "game_releases" ADD COLUMN "promoted_generation_id" text;--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "game_releases" release
		LEFT JOIN "game_release_artifacts" artifact
			ON artifact."release_id" = release."id"
		WHERE release."status" IN ('ready', 'live', 'quarantined')
			AND artifact."id" IS NULL
	) THEN
		RAISE EXCEPTION 'Cannot migrate a ready, live, or quarantined release without artifact metadata';
	END IF;
END
$$;--> statement-breakpoint
DO $$
DECLARE
	incompatible_artifact_ids text[];
BEGIN
	SELECT array_agg(artifact."id" ORDER BY artifact."id")
	INTO incompatible_artifact_ids
	FROM "game_release_artifacts" artifact
	WHERE NOT (
		artifact."id" = 'preview-artifact-001'
		AND artifact."release_id" = 'preview-release-001'
	)
	AND (
		btrim(artifact."original_filename") = ''
		OR btrim(artifact."content_type") = ''
		OR btrim(artifact."zip_object_key") = ''
		OR btrim(artifact."site_root_key") = ''
		OR btrim(artifact."entry_path") = ''
		OR artifact."size_bytes" <= 0
		OR artifact."extracted_size_bytes" IS NULL
		OR artifact."extracted_size_bytes" < 0
		OR artifact."file_count" IS NULL
		OR artifact."file_count" <= 0
		OR artifact."content_hash" IS NULL
		OR artifact."content_hash" !~ '^[0-9a-f]{64}$'
		OR EXISTS (
			SELECT 1
			FROM "game_release_artifacts" duplicate
			WHERE duplicate."id" <> artifact."id"
				AND duplicate."zip_object_key" = artifact."zip_object_key"
		)
		OR EXISTS (
			SELECT 1
			FROM "game_release_artifacts" duplicate
			WHERE duplicate."id" <> artifact."id"
				AND duplicate."site_root_key" = artifact."site_root_key"
		)
	);

	IF incompatible_artifact_ids IS NOT NULL THEN
		RAISE EXCEPTION 'Cannot migrate legacy release artifacts without complete, unique integrity metadata. Remediate artifact IDs: %', incompatible_artifact_ids;
	END IF;
END
$$;--> statement-breakpoint
UPDATE "games"
SET
	"arcade_visibility" = 'hidden',
	"updated_at" = now()
WHERE "id" = 'preview-game-001'
	AND EXISTS (
		SELECT 1
		FROM "game_releases" release
		INNER JOIN "game_release_artifacts" artifact
			ON artifact."release_id" = release."id"
		WHERE release."id" = 'preview-release-001'
			AND release."game_id" = "games"."id"
			AND artifact."id" = 'preview-artifact-001'
	);--> statement-breakpoint
UPDATE "game_releases"
SET
	"status" = 'archived',
	"archived_at" = coalesce("archived_at", now()),
	"published_at" = NULL
WHERE "id" = 'preview-release-001'
	AND "game_id" = 'preview-game-001'
	AND EXISTS (
		SELECT 1
		FROM "game_release_artifacts" artifact
		WHERE artifact."id" = 'preview-artifact-001'
			AND artifact."release_id" = "game_releases"."id"
	);--> statement-breakpoint
DELETE FROM "game_release_artifacts"
WHERE "id" = 'preview-artifact-001'
	AND "release_id" = 'preview-release-001';--> statement-breakpoint
INSERT INTO "game_release_generations" (
	"id",
	"release_id",
	"sequence",
	"status",
	"original_filename",
	"content_type",
	"declared_size_bytes",
	"zip_object_key",
	"site_root_key",
	"observed_size_bytes",
	"observed_content_type",
	"extracted_size_bytes",
	"file_count",
	"entry_path",
	"content_hash",
	"created_at",
	"upload_observed_at",
	"processing_started_at",
	"ready_at",
	"failed_at"
)
SELECT
	artifact."id",
	artifact."release_id",
	1,
	'ready',
	artifact."original_filename",
	artifact."content_type",
	artifact."size_bytes",
	artifact."zip_object_key",
	artifact."site_root_key",
	artifact."size_bytes",
	artifact."content_type",
	artifact."extracted_size_bytes",
	artifact."file_count",
	artifact."entry_path",
	artifact."content_hash",
	artifact."created_at" AT TIME ZONE 'UTC',
	coalesce(release."uploaded_at", artifact."created_at") AT TIME ZONE 'UTC',
	coalesce(release."uploaded_at", artifact."created_at") AT TIME ZONE 'UTC',
	coalesce(release."checked_at", release."uploaded_at", artifact."created_at") AT TIME ZONE 'UTC',
	NULL
FROM "game_release_artifacts" artifact
INNER JOIN "game_releases" release ON release."id" = artifact."release_id";--> statement-breakpoint
INSERT INTO "game_release_generations" (
	"id",
	"release_id",
	"sequence",
	"status",
	"original_filename",
	"content_type",
	"declared_size_bytes",
	"zip_object_key",
	"created_at",
	"failed_at"
)
SELECT
	release."id" || ':legacy-failed-generation',
	release."id",
	1,
	'failed',
	'artifact.zip',
	'application/zip',
	1,
	'legacy-missing/releases/' || release."id" || '/artifact.zip',
	release."created_at" AT TIME ZONE 'UTC',
	coalesce(release."checked_at", release."created_at") AT TIME ZONE 'UTC'
FROM "game_releases" release
LEFT JOIN "game_release_artifacts" artifact ON artifact."release_id" = release."id"
WHERE artifact."id" IS NULL
	AND (
		release."status" IN ('uploading', 'checking')
		OR EXISTS (
			SELECT 1
			FROM "game_release_checks" check_row
			WHERE check_row."release_id" = release."id"
		)
	);--> statement-breakpoint
UPDATE "game_release_checks" check_row
SET "generation_id" = generation."id"
FROM "game_release_generations" generation
WHERE generation."release_id" = check_row."release_id"
	AND generation."sequence" = 1;--> statement-breakpoint
UPDATE "game_releases"
SET
	"status" = 'failed',
	"candidate_generation_id" = NULL,
	"checked_at" = coalesce("checked_at", now())
WHERE "status" IN ('uploading', 'checking');--> statement-breakpoint
UPDATE "game_releases" release
SET "promoted_generation_id" = generation."id"
FROM "game_release_generations" generation
WHERE generation."release_id" = release."id"
	AND generation."status" = 'ready'
	AND release."status" <> 'draft';--> statement-breakpoint
ALTER TABLE "game_release_checks" ALTER COLUMN "generation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "game_release_artifacts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "game_release_artifacts";--> statement-breakpoint
ALTER TABLE "game_release_generations" ADD CONSTRAINT "game_release_generations_release_id_game_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."game_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_release_generations_release_sequence_idx" ON "game_release_generations" USING btree ("release_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "game_release_generations_release_scope_idx" ON "game_release_generations" USING btree ("id","release_id");--> statement-breakpoint
CREATE INDEX "game_release_generations_release_status_idx" ON "game_release_generations" USING btree ("release_id","status");--> statement-breakpoint
CREATE INDEX "game_release_generations_created_at_idx" ON "game_release_generations" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "game_release_checks" ADD CONSTRAINT "game_release_checks_generation_release_scope_fk" FOREIGN KEY ("generation_id","release_id") REFERENCES "public"."game_release_generations"("id","release_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_releases" ADD CONSTRAINT "game_releases_candidate_generation_fk" FOREIGN KEY ("candidate_generation_id","id") REFERENCES "public"."game_release_generations"("id","release_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_releases" ADD CONSTRAINT "game_releases_promoted_generation_fk" FOREIGN KEY ("promoted_generation_id","id") REFERENCES "public"."game_release_generations"("id","release_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_release_checks_generation_id_idx" ON "game_release_checks" USING btree ("generation_id");--> statement-breakpoint
ALTER TABLE "game_releases" ADD CONSTRAINT "game_releases_generation_lifecycle_check" CHECK ((
        "game_releases"."status" = 'draft'
        and "game_releases"."candidate_generation_id" is null
        and "game_releases"."promoted_generation_id" is null
      ) or (
        "game_releases"."status" in ('uploading', 'checking')
        and "game_releases"."candidate_generation_id" is not null
      ) or (
        "game_releases"."status" in ('ready', 'live', 'quarantined')
        and "game_releases"."candidate_generation_id" is null
        and "game_releases"."promoted_generation_id" is not null
      ) or (
        "game_releases"."status" = 'failed'
        and "game_releases"."candidate_generation_id" is null
      ) or "game_releases"."status" = 'archived');
