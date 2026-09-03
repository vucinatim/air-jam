import type {
  OperationalJob,
  OperationalJobEvent,
} from "@/server/jobs/operational-job-internals";
import {
  resolveDeploymentEnvironment,
  type JsonValue,
  type OperationalFailureV1,
} from "@air-jam/operations-contract";
import {
  enqueueOperationalEventInTransaction,
  type OperationalEventTransaction,
} from "./operational-event-delivery-service";

export const enqueueOperationalJobFailureEventInTransaction = async ({
  tx,
  job,
  jobEvent,
  failure,
  workerId,
  willRetry,
  retryAt,
  occurredAt,
}: {
  tx: OperationalEventTransaction;
  job: OperationalJob;
  jobEvent: OperationalJobEvent;
  failure: OperationalFailureV1;
  workerId: string;
  willRetry: boolean;
  retryAt: Date | null;
  occurredAt: Date;
}) => {
  const eventId = `event:job:${job.id}:revision:${job.revision}`;
  return enqueueOperationalEventInTransaction({
    tx,
    event: {
      contractVersion: 1,
      plane: "lifecycle_runtime",
      eventId,
      kind: `operational_job.${job.kind}.failed`,
      severity: willRetry ? "warning" : "error",
      outcome: "failed",
      authority: "airjam_authoritative",
      source: {
        service: "operational_worker",
        component: "operational-job-worker",
        environment: resolveDeploymentEnvironment(),
        version: process.env.RAILWAY_GIT_COMMIT_SHA?.trim() || undefined,
      },
      subject: { type: "operational_job", id: job.id },
      actor: { type: "system", id: workerId },
      correlation: {
        contractVersion: 1,
        correlationId: job.correlationId,
        jobId: job.id,
        ...(job.gameId ? { gameId: job.gameId } : {}),
        ...(job.releaseId ? { releaseId: job.releaseId } : {}),
        ...(job.generationId ? { generationId: job.generationId } : {}),
      },
      occurredAt: occurredAt.toISOString(),
      observedAt: occurredAt.toISOString(),
      payload: {
        failure: failure as unknown as JsonValue,
        attempt: job.attemptCount,
        willRetry,
        ...(retryAt ? { retryAt: retryAt.toISOString() } : {}),
      },
      evidence: [
        {
          kind: "job",
          reference: `operational-job-event:${jobEvent.id}`,
          collectedAt: occurredAt.toISOString(),
        },
      ],
    },
    now: occurredAt,
  });
};
