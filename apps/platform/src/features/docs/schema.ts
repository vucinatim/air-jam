import { z } from "zod";

export const docsIconSchema = z.enum([
  "info",
  "rocket",
  "lightbulb",
  "layers",
  "cpu",
  "code",
  "zap",
  "network",
  "bot",
]);

export const docsDocTypeSchema = z.enum([
  "concept",
  "guide",
  "reference",
  "contract",
  "migration",
  "agent",
]);

export const docsStabilitySchema = z.enum([
  "stable",
  "evolving",
  "experimental",
]);

export const docsAudienceSchema = z.enum([
  "user",
  "maintainer",
  "agent",
  "studio",
]);

const docsHrefPattern = /^\/docs(?:\/.*)?$/;
const docsSearchHrefPattern = /^\/docs(?:\/.*)?(?:#.+)?$/;

export const docsHrefSchema = z
  .string()
  .regex(docsHrefPattern)
  .transform((href) => href as `/docs${string}`);

export const docsSearchHrefSchema = z
  .string()
  .regex(docsSearchHrefPattern)
  .transform((href) => href as `/docs${string}`);

export const docsPageDefinitionSchema = z.object({
  title: z.string().min(1),
  href: docsHrefSchema,
  description: z.string().min(1),
  section: z.string().min(1),
  icon: docsIconSchema,
  keywords: z.array(z.string().min(1)),
  docType: docsDocTypeSchema,
  order: z.number().int().nonnegative(),
  sinceVersion: z.string().min(1).optional(),
  lastVerifiedVersion: z.string().min(1).optional(),
  stability: docsStabilitySchema.optional(),
  audience: docsAudienceSchema.optional(),
});

export const docsSectionSchema = z.object({
  title: z.string().min(1),
  pages: z.array(docsPageDefinitionSchema).min(1),
});

export const docsHeadingSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  depth: z.number().int().min(1).max(6),
  excerpt: z.string().min(1).optional(),
});

export const docsManifestEntrySchema = docsPageDefinitionSchema;

export const docsSearchEntrySchema = z.object({
  kind: z.enum(["page", "heading"]),
  title: z.string().min(1),
  section: z.string().min(1),
  href: docsSearchHrefSchema,
  description: z.string().min(1),
  keywords: z.array(z.string().min(1)),
  docType: docsDocTypeSchema,
  icon: docsIconSchema,
  pageTitle: z.string().min(1).optional(),
  depth: z.number().int().min(1).max(6).optional(),
});

export type DocsIcon = z.infer<typeof docsIconSchema>;
export type DocsDocType = z.infer<typeof docsDocTypeSchema>;
export type DocsStability = z.infer<typeof docsStabilitySchema>;
export type DocsAudience = z.infer<typeof docsAudienceSchema>;
export type DocsPageDefinition = z.infer<typeof docsPageDefinitionSchema>;
export type DocsSection = z.infer<typeof docsSectionSchema>;
export type DocsHeading = z.infer<typeof docsHeadingSchema>;
export type DocsPage = DocsPageDefinition;
export type DocsManifestEntry = z.infer<typeof docsManifestEntrySchema>;
export type DocsSearchEntry = z.infer<typeof docsSearchEntrySchema>;
