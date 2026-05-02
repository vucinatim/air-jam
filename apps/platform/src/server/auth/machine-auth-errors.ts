import type { PlatformMachineErrorCode } from "@air-jam/sdk/platform-machine";

export class PlatformMachineAuthError extends Error {
  readonly code: PlatformMachineErrorCode;
  readonly status: number;

  constructor({
    code,
    message,
    status,
  }: {
    code: PlatformMachineErrorCode;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = "PlatformMachineAuthError";
    this.code = code;
    this.status = status;
  }
}

export const isPlatformMachineAuthError = (
  value: unknown,
): value is PlatformMachineAuthError =>
  value instanceof PlatformMachineAuthError;
