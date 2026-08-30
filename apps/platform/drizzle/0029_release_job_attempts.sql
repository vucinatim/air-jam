CREATE TABLE "operational_job_attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"release_id" text NOT NULL,
	"generation_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"status" text NOT NULL,
	"lease_owner" text NOT NULL,
	"lease_token" text NOT NULL,
	"progress" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"last_error" jsonb,
	"output_root_key" text,
	"output_manifest" jsonb,
	"started_at" timestamp with time zone NOT NULL,
	"last_heartbeat_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"output_cleaned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "operational_job_attempts_lease_token_unique" UNIQUE("lease_token"),
	CONSTRAINT "operational_job_attempts_required_text_check" CHECK (btrim("operational_job_attempts"."id") <> '' and btrim("operational_job_attempts"."job_id") <> '' and btrim("operational_job_attempts"."release_id") <> '' and btrim("operational_job_attempts"."generation_id") <> '' and btrim("operational_job_attempts"."lease_owner") <> '' and btrim("operational_job_attempts"."lease_token") <> ''),
	CONSTRAINT "operational_job_attempts_attempt_check" CHECK ("operational_job_attempts"."attempt" > 0),
	CONSTRAINT "operational_job_attempts_status_check" CHECK ("operational_job_attempts"."status" in ('running', 'succeeded', 'failed', 'canceled', 'lease_expired')),
	CONSTRAINT "operational_job_attempts_json_shape_check" CHECK (jsonb_typeof("operational_job_attempts"."progress") = 'object' and ("operational_job_attempts"."result" is null or jsonb_typeof("operational_job_attempts"."result") = 'object') and ("operational_job_attempts"."last_error" is null or jsonb_typeof("operational_job_attempts"."last_error") = 'object') and ("operational_job_attempts"."output_manifest" is null or jsonb_typeof("operational_job_attempts"."output_manifest") = 'object')),
	CONSTRAINT "operational_job_attempts_output_root_check" CHECK ("operational_job_attempts"."output_root_key" is null or (btrim("operational_job_attempts"."output_root_key") <> '' and left("operational_job_attempts"."output_root_key", 1) <> '/' and strpos("operational_job_attempts"."output_root_key", '..') = 0)),
	CONSTRAINT "operational_job_attempts_output_cleanup_check" CHECK ("operational_job_attempts"."output_cleaned_at" is null or ("operational_job_attempts"."output_root_key" is not null and "operational_job_attempts"."status" in ('failed', 'canceled', 'lease_expired') and "operational_job_attempts"."finished_at" is not null and "operational_job_attempts"."output_cleaned_at" >= "operational_job_attempts"."finished_at")),
	CONSTRAINT "operational_job_attempts_lifecycle_check" CHECK ((
		"operational_job_attempts"."status" = 'running'
		and "operational_job_attempts"."finished_at" is null
		and "operational_job_attempts"."result" is null
		and "operational_job_attempts"."last_error" is null
	) or (
		"operational_job_attempts"."status" = 'succeeded'
		and "operational_job_attempts"."finished_at" is not null
		and "operational_job_attempts"."result" is not null
		and "operational_job_attempts"."last_error" is null
	) or (
		"operational_job_attempts"."status" in ('failed', 'lease_expired')
		and "operational_job_attempts"."finished_at" is not null
		and "operational_job_attempts"."last_error" is not null
	) or (
		"operational_job_attempts"."status" = 'canceled'
		and "operational_job_attempts"."finished_at" is not null
	))
);
--> statement-breakpoint
ALTER TABLE "operational_job_events" DROP CONSTRAINT "operational_job_events_kind_check";--> statement-breakpoint
ALTER TABLE "operational_jobs" DROP CONSTRAINT "operational_jobs_required_text_check";--> statement-breakpoint
DROP INDEX "operational_jobs_active_resource_idx";--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD COLUMN "generation_id" text;--> statement-breakpoint
DO $$
DECLARE
	active_job_ids text[];
BEGIN
	SELECT array_agg(job."id" ORDER BY job."id")
	INTO active_job_ids
	FROM "operational_jobs" job
	WHERE job."status" IN ('queued', 'running', 'cancel_requested');

	IF active_job_ids IS NOT NULL THEN
		RAISE EXCEPTION 'Cannot attach active legacy operational jobs to immutable release generations. Repair or cancel job IDs: %', active_job_ids;
	END IF;
END
$$;--> statement-breakpoint
DO $$
DECLARE
	ambiguous_job_ids text[];
BEGIN
	SELECT array_agg(job_id ORDER BY job_id)
	INTO ambiguous_job_ids
	FROM (
		SELECT check_row."job_id" AS job_id
		FROM "game_release_checks" check_row
		WHERE check_row."job_id" IS NOT NULL
		GROUP BY check_row."job_id"
		HAVING count(DISTINCT check_row."generation_id") > 1
	) ambiguous;

	IF ambiguous_job_ids IS NOT NULL THEN
		RAISE EXCEPTION 'Cannot attach legacy operational jobs with checks across multiple generations. Remediate job IDs: %', ambiguous_job_ids;
	END IF;
END
$$;--> statement-breakpoint
UPDATE "operational_jobs" job
SET "generation_id" = coalesce(
	(
		SELECT check_row."generation_id"
		FROM "game_release_checks" check_row
		WHERE check_row."job_id" = job."id"
		ORDER BY check_row."created_at" DESC, check_row."id" DESC
		LIMIT 1
	),
	release."candidate_generation_id",
	release."promoted_generation_id",
	(
		SELECT generation."id"
		FROM "game_release_generations" generation
		WHERE generation."release_id" = job."release_id"
		ORDER BY generation."sequence" DESC
		LIMIT 1
	)
)
FROM "game_releases" release
WHERE release."id" = job."release_id";--> statement-breakpoint
DO $$
DECLARE
	incompatible_job_ids text[];
BEGIN
	SELECT array_agg(job."id" ORDER BY job."id")
	INTO incompatible_job_ids
	FROM "operational_jobs" job
	WHERE job."generation_id" IS NULL
		OR (job."status" IN ('succeeded', 'failed') AND job."attempt_count" < 1)
		OR EXISTS (
			SELECT 1
			FROM "game_release_checks" check_row
			WHERE check_row."job_id" = job."id"
				AND check_row."job_attempt" > job."attempt_count"
		);

	IF incompatible_job_ids IS NOT NULL THEN
		RAISE EXCEPTION 'Cannot attach legacy operational jobs without complete generation and attempt evidence. Remediate job IDs: %', incompatible_job_ids;
	END IF;
END
$$;--> statement-breakpoint
ALTER TABLE "operational_jobs" ALTER COLUMN "generation_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_generation_scope_fk" FOREIGN KEY ("generation_id","release_id") REFERENCES "public"."game_release_generations"("id","release_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "operational_jobs_job_release_generation_scope_idx" ON "operational_jobs" USING btree ("id","release_id","generation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "operational_jobs_active_resource_idx" ON "operational_jobs" USING btree ("kind","generation_id") WHERE "operational_jobs"."status" in ('queued', 'running', 'cancel_requested');--> statement-breakpoint
INSERT INTO "operational_job_attempts" (
	"id", "job_id", "release_id", "generation_id", "attempt", "status",
	"lease_owner", "lease_token", "progress", "result", "last_error",
	"started_at", "last_heartbeat_at", "finished_at", "created_at", "updated_at"
)
SELECT
	job."id" || ':legacy-attempt:' || attempt_number::text,
	job."id",
	job."release_id",
	job."generation_id",
	attempt_number,
	CASE
		WHEN attempt_number < job."attempt_count" THEN 'lease_expired'
		ELSE job."status"
	END,
	'migration:0029',
	'migration:0029:' || job."id" || ':' || attempt_number::text,
	CASE WHEN attempt_number = job."attempt_count" THEN job."progress" ELSE '{}'::jsonb END,
	CASE WHEN attempt_number = job."attempt_count" AND job."status" = 'succeeded' THEN job."result" ELSE NULL END,
	CASE
		WHEN attempt_number < job."attempt_count" THEN jsonb_build_object(
			'code', 'legacy_attempt_history_unavailable',
			'message', 'The pre-attempt-ledger execution did not retain attempt-level failure evidence.',
			'retryable', false
		)
		WHEN job."status" = 'failed' THEN job."last_error"
		ELSE NULL
	END,
	coalesce(job."started_at", job."created_at"),
	coalesce(job."finished_at", job."updated_at", job."started_at", job."created_at"),
	job."finished_at",
	coalesce(job."started_at", job."created_at"),
	coalesce(job."finished_at", job."updated_at", job."created_at")
FROM "operational_jobs" job
CROSS JOIN LATERAL generate_series(1, job."attempt_count") AS attempt_number
WHERE job."status" IN ('succeeded', 'failed', 'canceled');--> statement-breakpoint
ALTER TABLE "operational_job_attempts" ADD CONSTRAINT "operational_job_attempts_job_scope_fk" FOREIGN KEY ("job_id","release_id","generation_id") REFERENCES "public"."operational_jobs"("id","release_id","generation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "operational_job_attempts_job_attempt_idx" ON "operational_job_attempts" USING btree ("job_id","attempt","generation_id");--> statement-breakpoint
CREATE INDEX "operational_job_attempts_generation_status_idx" ON "operational_job_attempts" USING btree ("generation_id","status");--> statement-breakpoint
CREATE INDEX "operational_job_attempts_finished_at_idx" ON "operational_job_attempts" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "operational_job_attempts_cleanup_idx" ON "operational_job_attempts" USING btree ("status","finished_at") WHERE "operational_job_attempts"."output_root_key" is not null and "operational_job_attempts"."output_cleaned_at" is null and "operational_job_attempts"."status" in ('failed', 'canceled', 'lease_expired');--> statement-breakpoint
ALTER TABLE "game_release_checks" ADD CONSTRAINT "game_release_checks_job_attempt_generation_fk" FOREIGN KEY ("job_id","job_attempt","generation_id") REFERENCES "public"."operational_job_attempts"("job_id","attempt","generation_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "operational_job_events" ADD CONSTRAINT "operational_job_events_kind_check" CHECK ("operational_job_events"."kind" in ('enqueued', 'claimed', 'stage_recorded', 'retry_scheduled', 'cancel_requested', 'canceled', 'succeeded', 'failed', 'lease_recovered', 'output_cleaned', 'replayed'));--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_required_text_check" CHECK (btrim("operational_jobs"."id") <> '' and btrim("operational_jobs"."creator_id") <> '' and btrim("operational_jobs"."game_id") <> '' and btrim("operational_jobs"."release_id") <> '' and btrim("operational_jobs"."generation_id") <> '' and btrim("operational_jobs"."created_by_command_id") <> '' and btrim("operational_jobs"."correlation_id") <> '');
