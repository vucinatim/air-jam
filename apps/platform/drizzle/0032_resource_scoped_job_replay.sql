ALTER TABLE "operational_jobs" DROP CONSTRAINT "operational_jobs_replay_of_fk";
--> statement-breakpoint
CREATE UNIQUE INDEX "operational_jobs_job_resource_scope_idx" ON "operational_jobs" USING btree ("id","resource_kind","resource_id");--> statement-breakpoint
ALTER TABLE "operational_jobs" ADD CONSTRAINT "operational_jobs_replay_of_fk" FOREIGN KEY ("replay_of_job_id","resource_kind","resource_id") REFERENCES "public"."operational_jobs"("id","resource_kind","resource_id") ON DELETE restrict ON UPDATE no action;
