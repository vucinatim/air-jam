ALTER TABLE "api_keys" RENAME TO "app_ids";--> statement-breakpoint
ALTER TABLE "app_ids" DROP CONSTRAINT "api_keys_game_id_unique";--> statement-breakpoint
ALTER TABLE "app_ids" DROP CONSTRAINT "api_keys_key_unique";--> statement-breakpoint
ALTER TABLE "app_ids" DROP CONSTRAINT "api_keys_game_id_games_id_fk";
--> statement-breakpoint
ALTER TABLE "app_ids" ADD CONSTRAINT "app_ids_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_ids" ADD CONSTRAINT "app_ids_game_id_unique" UNIQUE("game_id");--> statement-breakpoint
ALTER TABLE "app_ids" ADD CONSTRAINT "app_ids_key_unique" UNIQUE("key");