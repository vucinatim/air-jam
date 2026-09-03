import {
  DEFAULT_OPERATIONAL_EVENT_DELIVERY_MAX_ATTEMPTS,
  areOperationalEventEnvelopesIdempotentlyEquivalent,
  createStructuredOperationalFailure,
  operationalEventEnvelopeSchemaV1,
  type DeploymentEnvironment,
  type OperationalEventEnvelopeV1,
  type OperationalFailureClass,
  type OperationalSubjectType,
} from "@air-jam/operations-contract";
import { eq } from "drizzle-orm";
import type { ServerDatabase } from "../db.js";
import { operationalEventOutbox } from "../db.js";
import type { ServerLogger } from "../logging/logger.js";

export type ServerOperationalFailureInput = {
  code: string;
  failureClass: OperationalFailureClass;
  summary: string;
  retryable: boolean;
  component: string;
  subject: { type: OperationalSubjectType; id: string };
  correlation: OperationalEventEnvelopeV1["correlation"];
  occurredAt?: Date;
  details?: Record<string, unknown>;
};

export type ServerRuntimeErrorReportInput = {
  reportId: string;
  roomId: string;
  runtimeSessionId: string;
  controllerId?: string;
  gameId?: string;
  role: "host" | "controller";
  code: "AJ_RUNTIME_RENDER_CRASH";
  errorName: string;
  digest: string;
  clientOccurredAt: string;
};

export interface ServerOperationalEventPublisher {
  publishFailure(input: ServerOperationalFailureInput): Promise<void>;
  publishRuntimeErrorReport(
    input: ServerRuntimeErrorReportInput,
  ): Promise<void>;
}

const enqueueOperationalEvent = async ({
  database,
  event,
  persistedAt,
}: {
  database: ServerDatabase;
  event: OperationalEventEnvelopeV1;
  persistedAt: Date;
}): Promise<void> => {
  const maxAttempts = DEFAULT_OPERATIONAL_EVENT_DELIVERY_MAX_ATTEMPTS;
  const [inserted] = await database
    .insert(operationalEventOutbox)
    .values({
      id: event.eventId,
      contractVersion: event.contractVersion,
      envelope: event,
      maxAttempts,
      availableAt: persistedAt,
      createdAt: persistedAt,
      updatedAt: persistedAt,
    })
    .onConflictDoNothing({ target: operationalEventOutbox.id })
    .returning({ id: operationalEventOutbox.id });
  if (inserted) return;

  const [existing] = await database
    .select({
      envelope: operationalEventOutbox.envelope,
      maxAttempts: operationalEventOutbox.maxAttempts,
    })
    .from(operationalEventOutbox)
    .where(eq(operationalEventOutbox.id, event.eventId))
    .limit(1);
  if (
    !existing ||
    existing.maxAttempts !== maxAttempts ||
    !areOperationalEventEnvelopesIdempotentlyEquivalent(
      existing.envelope,
      event,
    )
  ) {
    const conflict = new Error(
      "The operational event ID was already used for a different event.",
    );
    conflict.name = "OperationalEventConflictError";
    throw conflict;
  }
};

export const createDatabaseServerOperationalEventPublisher = ({
  database,
  environment,
  instanceId,
}: {
  database: ServerDatabase | null;
  environment: DeploymentEnvironment;
  instanceId?: string;
}): ServerOperationalEventPublisher => ({
  async publishFailure(input) {
    if (!database) return;
    const occurredAt = input.occurredAt ?? new Date();
    const failure = createStructuredOperationalFailure({
      code: input.code,
      failureClass: input.failureClass,
      summary: input.summary,
      retryable: input.retryable,
      details: input.details,
    });
    const event = operationalEventEnvelopeSchemaV1.parse({
      contractVersion: 1,
      plane: "lifecycle_runtime",
      eventId: `server-failure:${crypto.randomUUID()}`,
      kind: input.code,
      severity: "error",
      outcome: "failed",
      authority: "airjam_authoritative",
      source: {
        service: "realtime_server",
        component: input.component,
        environment,
        ...(instanceId ? { instanceId } : {}),
      },
      subject: input.subject,
      actor: { type: "system", id: "airjam-server" },
      correlation: input.correlation,
      occurredAt: occurredAt.toISOString(),
      observedAt: occurredAt.toISOString(),
      payload: { failure },
      evidence: [],
    });
    await enqueueOperationalEvent({ database, event, persistedAt: occurredAt });
  },
  async publishRuntimeErrorReport(input) {
    if (!database) return;
    const observedAt = new Date();
    const event = operationalEventEnvelopeSchemaV1.parse({
      contractVersion: 1,
      plane: "lifecycle_runtime",
      eventId: `runtime-report:${input.reportId}`,
      kind: "hosted_runtime.render_crashed",
      severity: "error",
      outcome: "failed",
      authority: "runtime_reported",
      source: {
        service: "hosted_runtime",
        component: `${input.role}-render-boundary`,
        environment,
        ...(instanceId ? { instanceId } : {}),
      },
      subject: { type: "runtime_session", id: input.runtimeSessionId },
      correlation: {
        contractVersion: 1,
        correlationId: `runtime-report:${input.reportId}`,
        roomId: input.roomId,
        runtimeSessionId: input.runtimeSessionId,
        ...(input.controllerId ? { controllerId: input.controllerId } : {}),
        ...(input.gameId ? { gameId: input.gameId } : {}),
      },
      occurredAt: observedAt.toISOString(),
      observedAt: observedAt.toISOString(),
      payload: {
        report: {
          contractVersion: 1,
          reportId: input.reportId,
          role: input.role,
          code: input.code,
          errorName: input.errorName,
          digest: input.digest,
          clientOccurredAt: input.clientOccurredAt,
        },
      },
      evidence: [],
    });
    await enqueueOperationalEvent({ database, event, persistedAt: observedAt });
  },
});

export const publishServerOperationalFailureSafely = ({
  publisher,
  logger,
  input,
}: {
  publisher: ServerOperationalEventPublisher;
  logger: ServerLogger;
  input: ServerOperationalFailureInput;
}): void => {
  void publisher.publishFailure(input).catch((error: unknown) => {
    logger.warn(
      {
        event: "operational_event.publish_failed",
        failureCode: input.code,
        causeCode: error instanceof Error ? error.name : "unknown_error",
      },
      "Failed to enqueue a structured operational event",
    );
  });
};
