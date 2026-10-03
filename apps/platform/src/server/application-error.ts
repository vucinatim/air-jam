export type PlatformApplicationErrorCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "rate_limited"
  | "validation_failed";

export class PlatformApplicationError extends Error {
  readonly code: PlatformApplicationErrorCode;
  readonly retryAfterSeconds: number | null;

  constructor({
    code,
    message,
    retryAfterSeconds = null,
  }: {
    code: PlatformApplicationErrorCode;
    message: string;
    retryAfterSeconds?: number | null;
  }) {
    super(message);
    this.name = "PlatformApplicationError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
