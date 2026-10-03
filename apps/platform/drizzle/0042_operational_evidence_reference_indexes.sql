-- airjam:migration-mode=online
-- airjam:verify=index:operational_event_delivery_commands_retention_age_idx
-- airjam:verify=index:operational_event_delivery_commands_audit_event_idx
-- airjam:verify=index:operational_event_outbox_retention_age_idx
-- airjam:verify=index:operational_event_outbox_evidence_idx
-- airjam:verify=index:operational_event_outbox_causation_idx
-- airjam:verify=index:operational_event_outbox_evaluation_idx
-- airjam:verify=index:operational_events_retention_age_idx
-- airjam:verify=index:operational_events_evidence_idx
-- airjam:verify=index:operational_events_causation_idx
-- airjam:verify=index:operational_events_evaluation_idx
-- airjam:verify=index:operational_slo_evaluations_trigger_event_idx
-- airjam:verify=index:operational_slo_evaluations_retention_age_idx
-- airjam:verify=index:operational_slo_evaluations_evidence_idx
-- airjam:verify=index:operational_synthetic_runs_event_idx
-- airjam:verify=index:operational_synthetic_runs_retention_age_idx
-- airjam:verify=index:operational_synthetic_runs_evidence_idx
CREATE INDEX "operational_event_delivery_commands_retention_age_idx" ON "operational_event_delivery_commands" USING btree (greatest("created_at", "completed_at"),"id");--> statement-breakpoint
CREATE INDEX "operational_event_delivery_commands_audit_event_idx" ON "operational_event_delivery_commands" USING btree (("result" ->> 'auditEventId')) WHERE ("operational_event_delivery_commands"."result" ->> 'auditEventId') is not null;--> statement-breakpoint
CREATE INDEX "operational_event_outbox_retention_age_idx" ON "operational_event_outbox" USING btree (greatest("created_at", "updated_at", "delivered_at"),"id");--> statement-breakpoint
CREATE INDEX "operational_event_outbox_evidence_idx" ON "operational_event_outbox" USING gin (("envelope" -> 'evidence') jsonb_path_ops) WITH (fastupdate=false);--> statement-breakpoint
CREATE INDEX "operational_event_outbox_causation_idx" ON "operational_event_outbox" USING btree (("envelope" #>> '{correlation,causationEventId}')) WHERE ("operational_event_outbox"."envelope" #>> '{correlation,causationEventId}') is not null;--> statement-breakpoint
CREATE INDEX "operational_event_outbox_evaluation_idx" ON "operational_event_outbox" USING btree (("envelope" #>> '{payload,evaluationId}')) WHERE ("operational_event_outbox"."envelope" #>> '{payload,evaluationId}') is not null;--> statement-breakpoint
CREATE INDEX "operational_events_retention_age_idx" ON "operational_events" USING btree (greatest("stored_at", "occurred_at", "observed_at"),"id");--> statement-breakpoint
CREATE INDEX "operational_events_evidence_idx" ON "operational_events" USING gin (("envelope" -> 'evidence') jsonb_path_ops) WITH (fastupdate=false);--> statement-breakpoint
CREATE INDEX "operational_events_causation_idx" ON "operational_events" USING btree (("envelope" #>> '{correlation,causationEventId}')) WHERE ("operational_events"."envelope" #>> '{correlation,causationEventId}') is not null;--> statement-breakpoint
CREATE INDEX "operational_events_evaluation_idx" ON "operational_events" USING btree (("envelope" #>> '{payload,evaluationId}')) WHERE ("operational_events"."envelope" #>> '{payload,evaluationId}') is not null;--> statement-breakpoint
CREATE INDEX "operational_slo_evaluations_trigger_event_idx" ON "operational_slo_evaluations" USING btree ("trigger_event_id");--> statement-breakpoint
CREATE INDEX "operational_slo_evaluations_retention_age_idx" ON "operational_slo_evaluations" USING btree (greatest("created_at", "evaluated_at"),"id");--> statement-breakpoint
CREATE INDEX "operational_slo_evaluations_evidence_idx" ON "operational_slo_evaluations" USING gin (("document" -> 'evidence') jsonb_path_ops) WITH (fastupdate=false);--> statement-breakpoint
CREATE INDEX "operational_synthetic_runs_event_idx" ON "operational_synthetic_runs" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "operational_synthetic_runs_retention_age_idx" ON "operational_synthetic_runs" USING btree (greatest("created_at", "completed_at"),"id");--> statement-breakpoint
CREATE INDEX "operational_synthetic_runs_evidence_idx" ON "operational_synthetic_runs" USING gin (("document" -> 'evidence') jsonb_path_ops) WITH (fastupdate=false);
