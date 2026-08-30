export type PlatformApplicationErrorCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "validation_failed";

export class PlatformApplicationError extends Error {
  readonly code: PlatformApplicationErrorCode;

  constructor({
    code,
    message,
  }: {
    code: PlatformApplicationErrorCode;
    message: string;
  }) {
    super(message);
    this.name = "PlatformApplicationError";
    this.code = code;
  }
}
