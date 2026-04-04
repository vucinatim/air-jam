CREATE TABLE "game_release_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"status" text NOT NULL,
	"source" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"reporter_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp,
	CONSTRAINT "game_release_reports_release_id_game_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."game_releases"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "game_release_reports_release_id_idx" ON "game_release_reports" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "game_release_reports_status_idx" ON "game_release_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "game_release_reports_created_at_idx" ON "game_release_reports" USING btree ("created_at");
