CREATE TABLE "machine_auth_device_grants" (
	"id" text PRIMARY KEY NOT NULL,
	"device_code" text NOT NULL,
	"user_code" text NOT NULL,
	"client_name" text,
	"status" text NOT NULL,
	"user_id" text,
	"session_token" text,
	"expires_at" timestamp NOT NULL,
	"approved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "machine_auth_device_grants_device_code_unique" UNIQUE("device_code"),
	CONSTRAINT "machine_auth_device_grants_user_code_unique" UNIQUE("user_code")
);
--> statement-breakpoint
ALTER TABLE "machine_auth_device_grants" ADD CONSTRAINT "machine_auth_device_grants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "machine_auth_device_grants_device_code_idx" ON "machine_auth_device_grants" USING btree ("device_code");
--> statement-breakpoint
CREATE INDEX "machine_auth_device_grants_user_code_idx" ON "machine_auth_device_grants" USING btree ("user_code");
--> statement-breakpoint
CREATE INDEX "machine_auth_device_grants_status_idx" ON "machine_auth_device_grants" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "machine_auth_device_grants_expires_at_idx" ON "machine_auth_device_grants" USING btree ("expires_at");
--> statement-breakpoint
CREATE INDEX "machine_auth_device_grants_user_id_idx" ON "machine_auth_device_grants" USING btree ("user_id");
