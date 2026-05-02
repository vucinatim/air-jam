import type { ZodType, output } from "zod";

export interface EnvValidationIssue {
  envKey: string;
  expected: string;
  received?: string;
  message: string;
  fix: string;
}

export interface EnvValidationErrorInput {
  boundary: string;
  issues: EnvValidationIssue[];
  docsHint?: string;
}

export declare class EnvValidationError extends Error {
  boundary: string;
  issues: EnvValidationIssue[];
  docsHint?: string;
  constructor(input: EnvValidationErrorInput);
}

export interface ValidateEnvInput<TSchema extends ZodType> {
  boundary: string;
  schema: TSchema;
  env?: Record<string, string | undefined>;
  docsHint?: string;
  keyHints?: Record<string, string>;
}

export interface FormatEnvValidationErrorOptions {
  color?: boolean;
  includeReceived?: boolean;
  docsHint?: string;
}

export declare const isEnvValidationError: (
  error: unknown,
) => error is EnvValidationError;

export declare const validateEnv: <TSchema extends ZodType>(
  input: ValidateEnvInput<TSchema>,
) => output<TSchema>;

export declare const formatEnvValidationError: (
  error: unknown,
  options?: FormatEnvValidationErrorOptions,
) => string;
