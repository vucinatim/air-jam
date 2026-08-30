ALTER TABLE "operational_jobs" DROP CONSTRAINT "operational_jobs_created_by_command_id_unique";--> statement-breakpoint
ALTER TABLE "operational_job_commands" DROP CONSTRAINT "operational_job_commands_kind_check";--> statement-breakpoint
CREATE INDEX "operational_jobs_created_by_command_idx" ON "operational_jobs" USING btree ("created_by_command_id");--> statement-breakpoint
ALTER TABLE "operational_job_commands" ADD CONSTRAINT "operational_job_commands_kind_check" CHECK ("operational_job_commands"."kind" in ('enqueue', 'schedule_cleanup', 'cancel', 'replay', 'repair_expired'));