CREATE TYPE "public"."user_role" AS ENUM('creator', 'ops_admin');
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'creator' NOT NULL;
