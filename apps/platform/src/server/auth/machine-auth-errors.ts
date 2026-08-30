import type { PlatformMachineErrorCode } from "@air-jam/sdk/platform-machine";
import { OperationalAdmissionDeniedError } from "../operations/production-control-service";

export class PlatformMachineAuthError extends Error {
  readonly code: PlatformMachineErrorCode;
  readonly status: number;
  readonly retryAfterSeconds: number | null;
  readonly details: Record<string, unknown> | undefined;

  constructor({
    code,
    message,
    status,
    retryAfterSeconds = null,
    details,
  }: {
    code: PlatformMachineErrorCode;
    message: string;
    status: number;
    retryAfterSeconds?: number | null;
    details?: Record<string, unknown>;
  }) {
    super(message);
    this.name = "PlatformMachineAuthError";
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
    this.details = details;
  }
}

export const isPlatformMachineAuthError = (
  value: unknown,
): value is PlatformMachineAuthError =>
  value instanceof PlatformMachineAuthError;

export const rethrowOperationalAdmissionForMachine = (error: unknown): void => {
  if (!(error instanceof OperationalAdmissionDeniedError)) return;
  throw new PlatformMachineAuthError({
    code: "rate_limited",
    message: error.message,
    status: 503,
    retryAfterSeconds: error.decision.retryAfterSeconds,
    details: { decision: error.decision },
  });
};
