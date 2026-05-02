CREATE TABLE "game_releases" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"source_kind" text NOT NULL,
	"status" text NOT NULL,
	"version_label" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"uploaded_at" timestamp,
	"checked_at" timestamp,
	"published_at" timestamp,
	"quarantined_at" timestamp,
	"archived_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "game_release_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"extracted_size_bytes" integer,
	"file_count" integer,
	"zip_object_key" text NOT NULL,
	"site_root_key" text NOT NULL,
	"entry_path" text NOT NULL,
	"content_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_release_artifacts_release_id_unique" UNIQUE("release_id")
);
--> statement-breakpoint
CREATE TABLE "game_release_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"summary" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_releases" ADD CONSTRAINT "game_releases_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_release_artifacts" ADD CONSTRAINT "game_release_artifacts_release_id_game_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."game_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_release_checks" ADD CONSTRAINT "game_release_checks_release_id_game_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."game_releases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_releases_game_id_idx" ON "game_releases" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "game_releases_status_idx" ON "game_releases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_releases_created_at_idx" ON "game_releases" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "game_release_artifacts_release_id_idx" ON "game_release_artifacts" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "game_release_artifacts_created_at_idx" ON "game_release_artifacts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "game_release_checks_release_id_idx" ON "game_release_checks" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "game_release_checks_kind_idx" ON "game_release_checks" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "game_release_checks_status_idx" ON "game_release_checks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_release_checks_created_at_idx" ON "game_release_checks" USING btree ("created_at");
