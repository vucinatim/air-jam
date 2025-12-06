ALTER TABLE "games" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "thumbnail_url" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "cover_url" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "min_players" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "max_players" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "orientation" text DEFAULT 'landscape' NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "config" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_slug_unique" UNIQUE("slug");