import {
  normalizeUnknownOperationalFailure,
  operationalEventEnvelopeSchemaV1,
  resolveDeploymentEnvironment,
  type DeploymentEnvironment,
  type OperationalEventEnvelopeV1,
} from "@air-jam/operations-contract";
import { enqueueOperationalEvent } from "./operational-event-delivery-service";

export type PlatformRequestErrorContext = {
  method: string;
  routerKind: string;
  routeType: string;
};

export const createPlatformRequestFailureEvent = ({
  error,
  context,
  environment,
  eventId,
  observedAt,
}: {
  error: unknown;
  context: PlatformRequestErrorContext;
  environment: DeploymentEnvironment;
  eventId: string;
  observedAt: Date;
}): OperationalEventEnvelopeV1 =>
  operationalEventEnvelopeSchemaV1.parse({
    contractVersion: 1,
    plane: "lifecycle_runtime",
    eventId,
    kind: "platform.request.failed",
    severity: "error",
    outcome: "failed",
    authority: "airjam_authoritative",
    source: {
      service: "platform",
      component: "next-request-boundary",
      environment,
      version: process.env.RAILWAY_GIT_COMMIT_SHA?.trim() || undefined,
    },
    subject: { type: "service", id: "platform" },
    actor: { type: "system", id: "airjam-platform" },
    correlation: {
      contractVersion: 1,
      correlationId: eventId,
    },
    occurredAt: observedAt.toISOString(),
    observedAt: observedAt.toISOString(),
    payload: {
      failure: normalizeUnknownOperationalFailure({
        error,
        code: "platform.request_failed",
        summary: "The platform request boundary caught an unhandled failure.",
        retryable: false,
        details: {
          method: context.method.slice(0, 16),
          routerKind: context.routerKind.slice(0, 80),
          routeType: context.routeType.slice(0, 80),
        },
      }),
    },
    evidence: [],
  });

export const publishPlatformRequestFailure = async ({
  error,
  context,
}: {
  error: unknown;
  context: PlatformRequestErrorContext;
}): Promise<void> => {
  const observedAt = new Date();
  await enqueueOperationalEvent({
    event: createPlatformRequestFailureEvent({
      error,
      context,
      environment: resolveDeploymentEnvironment(),
      eventId: `platform-request-failure:${crypto.randomUUID()}`,
      observedAt,
    }),
    now: observedAt,
  });
};
