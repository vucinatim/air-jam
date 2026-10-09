import type { ServerLogger } from "../logging/logger.js";

export type ServerOperationalFailureInput = {
  code: string;
  failureClass:
    | "invalid_input"
    | "authorization"
    | "conflict"
    | "dependency"
    | "timeout"
    | "capacity"
    | "unavailable"
    | "internal";
  summary: string;
  retryable: boolean;
  component: string;
  subject: { type: "service" | "runtime_session"; id: string };
  correlation: {
    contractVersion: 1;
    correlationId: string;
    roomId?: string;
    runtimeSessionId?: string;
    controllerId?: string;
    gameId?: string;
  };
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

export const createNoopServerOperationalEventPublisher =
  (): ServerOperationalEventPublisher => ({
    publishFailure: async () => undefined,
    publishRuntimeErrorReport: async () => undefined,
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
