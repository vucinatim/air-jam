import { z } from "zod";

export const PRODUCT_TELEMETRY_SCHEMA_VERSION = 1 as const;
export const PRODUCT_TELEMETRY_MAX_BATCH_SIZE = 20;
export const PRODUCT_TELEMETRY_MAX_REQUEST_BYTES = 16_384;

export const productTelemetrySurfaceSchema = z.enum([
  "landing",
  "docs",
  "blog",
  "arcade",
  "auth",
  "dashboard",
  "agent_resource",
  "other",
]);

export const productTelemetryActorClassSchema = z.enum([
  "human",
  "bot",
  "agent",
  "unknown",
]);
export const PRODUCT_TELEMETRY_ACTOR_CLASSES =
  productTelemetryActorClassSchema.options;

export const productTelemetryAgentFamilySchema = z.enum([
  "openai",
  "anthropic",
  "perplexity",
  "google",
  "microsoft",
  "meta",
  "bytedance",
  "other",
]);
export const PRODUCT_TELEMETRY_AGENT_FAMILIES =
  productTelemetryAgentFamilySchema.options;

export const productTelemetryDeploymentEnvironmentSchema = z.enum([
  "production",
  "preview",
  "development",
  "test",
]);

export const productTelemetryReferrerSourceSchema = z.enum([
  "direct",
  "internal",
  "search",
  "social",
  "ai",
  "github",
  "npm",
  "other",
]);
export const PRODUCT_TELEMETRY_REFERRER_SOURCES =
  productTelemetryReferrerSourceSchema.options;

export const productTelemetryPlacementSchema = z.enum([
  "landing_hero",
  "landing_final",
  "header",
  "footer",
  "docs",
  "arcade",
]);

export const productTelemetryExternalTargetSchema = z.enum(["github", "npm"]);

export const productTelemetryAgentResourceSchema = z.enum([
  "llms_txt",
  "docs_manifest",
  "docs_search_index",
  "ai_pack_manifest",
]);
export const PRODUCT_TELEMETRY_AGENT_RESOURCES =
  productTelemetryAgentResourceSchema.options;

const telemetryPathnameSchema = z
  .string()
  .min(1)
  .max(180)
  .regex(/^\/[A-Za-z0-9/_.-]*$/);

const telemetryReferrerHostSchema = z
  .string()
  .min(1)
  .max(253)
  .regex(/^[A-Za-z0-9.-]+$/)
  .transform((value) => value.toLowerCase());

const telemetryCampaignValueSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._-]+$/);

export const productTelemetryCampaignSchema = z
  .object({
    source: telemetryCampaignValueSchema.optional(),
    medium: telemetryCampaignValueSchema.optional(),
    campaign: telemetryCampaignValueSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.source !== undefined ||
      value.medium !== undefined ||
      value.campaign !== undefined,
    "At least one campaign field is required.",
  );

const browserEventEnvelopeSchema = z
  .object({
    id: z.string().uuid(),
    schemaVersion: z.literal(PRODUCT_TELEMETRY_SCHEMA_VERSION),
    occurredAt: z.string().datetime({ offset: true }),
    anonymousSessionId: z.string().uuid(),
    pathname: telemetryPathnameSchema,
    referrerHost: telemetryReferrerHostSchema.optional(),
    campaign: productTelemetryCampaignSchema.optional(),
  })
  .strict();

const pageViewEventSchema = browserEventEnvelopeSchema.extend({
  kind: z.literal("page_view"),
});

const quickStartOpenedEventSchema = browserEventEnvelopeSchema.extend({
  kind: z.literal("quick_start_opened"),
  placement: productTelemetryPlacementSchema,
});

const scaffoldCommandCopiedEventSchema = browserEventEnvelopeSchema.extend({
  kind: z.literal("scaffold_command_copied"),
  placement: productTelemetryPlacementSchema,
});

const arcadeEnteredEventSchema = browserEventEnvelopeSchema.extend({
  kind: z.literal("arcade_entered"),
  placement: productTelemetryPlacementSchema,
});

const externalLinkOpenedEventSchema = browserEventEnvelopeSchema.extend({
  kind: z.literal("external_link_opened"),
  placement: productTelemetryPlacementSchema,
  target: productTelemetryExternalTargetSchema,
});

export const productTelemetryBrowserEventSchema = z.discriminatedUnion("kind", [
  pageViewEventSchema,
  quickStartOpenedEventSchema,
  scaffoldCommandCopiedEventSchema,
  arcadeEnteredEventSchema,
  externalLinkOpenedEventSchema,
]);

export const productTelemetryBrowserBatchSchema = z
  .object({
    events: z
      .array(productTelemetryBrowserEventSchema)
      .min(1)
      .max(PRODUCT_TELEMETRY_MAX_BATCH_SIZE),
  })
  .strict();

export const productTelemetryStoredEventKindSchema = z.enum([
  "page_view",
  "quick_start_opened",
  "scaffold_command_copied",
  "arcade_entered",
  "external_link_opened",
  "agent_resource_requested",
]);

export type ProductTelemetrySurface = z.infer<
  typeof productTelemetrySurfaceSchema
>;
export type ProductTelemetryActorClass = z.infer<
  typeof productTelemetryActorClassSchema
>;
export type ProductTelemetryAgentFamily = z.infer<
  typeof productTelemetryAgentFamilySchema
>;
export type ProductTelemetryDeploymentEnvironment = z.infer<
  typeof productTelemetryDeploymentEnvironmentSchema
>;
export type ProductTelemetryReferrerSource = z.infer<
  typeof productTelemetryReferrerSourceSchema
>;
export type ProductTelemetryPlacement = z.infer<
  typeof productTelemetryPlacementSchema
>;
export type ProductTelemetryExternalTarget = z.infer<
  typeof productTelemetryExternalTargetSchema
>;
export type ProductTelemetryAgentResource = z.infer<
  typeof productTelemetryAgentResourceSchema
>;
export type ProductTelemetryBrowserEvent = z.infer<
  typeof productTelemetryBrowserEventSchema
>;
export type ProductTelemetryBrowserBatch = z.infer<
  typeof productTelemetryBrowserBatchSchema
>;
export type ProductTelemetryStoredEventKind = z.infer<
  typeof productTelemetryStoredEventKindSchema
>;
