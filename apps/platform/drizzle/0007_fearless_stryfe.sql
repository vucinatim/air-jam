ALTER TABLE "games" ALTER COLUMN "config" SET DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "app_ids" RENAME CONSTRAINT "api_keys_pkey" TO "app_ids_pkey";
