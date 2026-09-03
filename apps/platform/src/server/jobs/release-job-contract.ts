import type { OperationalJobKind } from "@air-jam/database-contract";
import { z } from "zod";

export const releaseJobPayloadContractVersion = 1 as const;
export const releaseJobExecutionContractVersion = 1 as const;

export type ReleaseOperationalJobKind = Exclude<
  OperationalJobKind,
  "lifecycle_cleanup"
>;

export const releaseOperationalJobKinds = Object.freeze([
  "release_artifact_processing",
  "release_browser_validation",
  "release_image_moderation",
] satisfies ReleaseOperationalJobKind[]);

const releaseOperationalJobKindSet: ReadonlySet<string> = new Set(
  releaseOperationalJobKinds,
);

export const isReleaseOperationalJobKind = (
  kind: OperationalJobKind,
): kind is ReleaseOperationalJobKind => releaseOperationalJobKindSet.has(kind);

const identifierSchema = z.string().trim().min(1).max(256);
const storageKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(2_048)
  .refine((value) => !value.startsWith("/"), "Storage keys are relative.")
  .refine((value) => !value.includes(".."), "Storage keys cannot traverse.");
const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const releaseScreenshotSchema = z
  .object({
    captureId: identifierSchema,
    objectKey: storageKeySchema,
    contentType: z.literal("image/png"),
    sizeBytes: z.number().int().positive(),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })
  .strict();

const basePayloadSchema = z
  .object({
    contractVersion: z.literal(releaseJobPayloadContractVersion),
    generationId: identifierSchema,
  })
  .strict();

export const releaseArtifactProcessingPayloadSchema = basePayloadSchema;

export const releaseBrowserValidationPayloadSchema = basePayloadSchema;

export const releaseImageModerationPayloadSchema = basePayloadSchema
  .extend({
    screenshot: releaseScreenshotSchema,
  })
  .strict();

export const releaseJobPayloadSchemas = Object.freeze({
  release_artifact_processing: releaseArtifactProcessingPayloadSchema,
  release_browser_validation: releaseBrowserValidationPayloadSchema,
  release_image_moderation: releaseImageModerationPayloadSchema,
} satisfies Readonly<Record<ReleaseOperationalJobKind, z.ZodType>>);

export type ReleaseArtifactProcessingPayload = z.infer<
  typeof releaseArtifactProcessingPayloadSchema
>;
export type ReleaseBrowserValidationPayload = z.infer<
  typeof releaseBrowserValidationPayloadSchema
>;
export type ReleaseImageModerationPayload = z.infer<
  typeof releaseImageModerationPayloadSchema
>;
export type ReleaseJobPayload =
  | ReleaseArtifactProcessingPayload
  | ReleaseBrowserValidationPayload
  | ReleaseImageModerationPayload;

export const parseReleaseJobPayload = <Kind extends ReleaseOperationalJobKind>(
  kind: Kind,
  payload: unknown,
): z.output<(typeof releaseJobPayloadSchemas)[Kind]> =>
  releaseJobPayloadSchemas[kind].parse(payload) as z.output<
    (typeof releaseJobPayloadSchemas)[Kind]
  >;

export const releaseJobProgressSchema = z
  .object({
    contractVersion: z.literal(releaseJobExecutionContractVersion),
    stage: z.enum([
      "observing_upload",
      "reading_source",
      "validating_archive",
      "writing_outputs",
      "launching_browser",
      "capturing_screenshot",
      "reading_screenshot",
      "moderating_image",
      "committing",
    ]),
    message: z.string().trim().min(1).max(1_000).optional(),
    completedUnits: z.number().int().nonnegative().optional(),
    totalUnits: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.completedUnits !== undefined &&
      value.totalUnits !== undefined &&
      value.completedUnits > value.totalUnits
    ) {
      context.addIssue({
        code: "custom",
        path: ["completedUnits"],
        message: "Completed units cannot exceed total units.",
      });
    }
  });

export type ReleaseJobProgress = z.infer<typeof releaseJobProgressSchema>;

export const releaseArtifactProcessingResultSchema = z
  .object({
    contractVersion: z.literal(releaseJobExecutionContractVersion),
    generationId: identifierSchema,
    siteRootKey: storageKeySchema,
    contentHash: sha256Schema,
    extractedSizeBytes: z.number().int().nonnegative(),
    fileCount: z.number().int().positive(),
    entryPath: z.string().trim().min(1).max(2_048),
    nextJobId: identifierSchema,
  })
  .strict();

export const releaseBrowserValidationResultSchema = z
  .object({
    contractVersion: z.literal(releaseJobExecutionContractVersion),
    generationId: identifierSchema,
    screenshot: releaseScreenshotSchema,
    nextJobId: identifierSchema,
  })
  .strict();

export const releaseImageModerationResultSchema = z
  .object({
    contractVersion: z.literal(releaseJobExecutionContractVersion),
    generationId: identifierSchema,
    decision: z.enum(["ready", "quarantined"]),
    provider: z.string().trim().min(1).max(128).nullable(),
    model: z.string().trim().min(1).max(256).nullable(),
  })
  .strict();

export const releaseJobResultSchemas = Object.freeze({
  release_artifact_processing: releaseArtifactProcessingResultSchema,
  release_browser_validation: releaseBrowserValidationResultSchema,
  release_image_moderation: releaseImageModerationResultSchema,
} satisfies Readonly<Record<ReleaseOperationalJobKind, z.ZodType>>);

export const parseReleaseJobResult = <Kind extends ReleaseOperationalJobKind>(
  kind: Kind,
  result: unknown,
): z.output<(typeof releaseJobResultSchemas)[Kind]> =>
  releaseJobResultSchemas[kind].parse(result) as z.output<
    (typeof releaseJobResultSchemas)[Kind]
  >;

export const releaseJobErrorSchema = z
  .object({
    contractVersion: z.literal(releaseJobExecutionContractVersion),
    code: z.string().trim().min(1).max(128),
    message: z.string().trim().min(1).max(2_000),
    stage: releaseJobProgressSchema.shape.stage.nullable(),
    retryable: z.boolean(),
  })
  .strict();

export type ReleaseJobError = z.infer<typeof releaseJobErrorSchema>;

export class ReleaseJobExecutionError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly stage: ReleaseJobProgress["stage"] | null;

  constructor({
    code,
    message,
    retryable,
    stage = null,
    cause,
  }: {
    code: string;
    message: string;
    retryable: boolean;
    stage?: ReleaseJobProgress["stage"] | null;
    cause?: unknown;
  }) {
    super(message, { cause });
    this.name = "ReleaseJobExecutionError";
    this.code = code;
    this.retryable = retryable;
    this.stage = stage;
  }
}

export const parseReleaseJobError = (error: unknown): ReleaseJobError =>
  releaseJobErrorSchema.parse(error);

export const serializeReleaseJobExecutionError = ({
  error,
  stage,
}: {
  error: unknown;
  stage: ReleaseJobProgress["stage"] | null;
}): ReleaseJobError => {
  const failure =
    error instanceof ReleaseJobExecutionError
      ? error
      : new ReleaseJobExecutionError({
          code: "unexpected_executor_error",
          message: "Release executor failed unexpectedly.",
          retryable: true,
          stage,
          cause: error,
        });
  return releaseJobErrorSchema.parse({
    contractVersion: releaseJobExecutionContractVersion,
    code: failure.code,
    message: failure.message,
    stage: failure.stage ?? stage,
    retryable: failure.retryable,
  });
};

export const createReleaseGenerationJobPayload = ({
  generationId,
}: {
  generationId: string;
}): ReleaseArtifactProcessingPayload =>
  releaseArtifactProcessingPayloadSchema.parse({
    contractVersion: releaseJobPayloadContractVersion,
    generationId,
  });

export const createReleaseBrowserValidationJobPayload = ({
  generationId,
}: {
  generationId: string;
}): ReleaseBrowserValidationPayload =>
  releaseBrowserValidationPayloadSchema.parse({
    contractVersion: releaseJobPayloadContractVersion,
    generationId,
  });

export const createReleaseImageModerationJobPayload = ({
  generationId,
  screenshot,
}: {
  generationId: string;
  screenshot: ReleaseImageModerationPayload["screenshot"];
}): ReleaseImageModerationPayload =>
  releaseImageModerationPayloadSchema.parse({
    contractVersion: releaseJobPayloadContractVersion,
    generationId,
    screenshot,
  });
