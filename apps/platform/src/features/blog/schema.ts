import { z } from "zod";

const blogSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const blogHrefPattern = /^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const blogSlugSchema = z
  .string()
  .regex(blogSlugPattern)
  .transform((slug) => slug as string);

export const blogHrefSchema = z
  .string()
  .regex(blogHrefPattern)
  .transform((href) => href as `/blog/${string}`);

const coverImageSchema = z.object({
  src: z.string().min(1).startsWith("/"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string().min(1).optional(),
});

export type BlogPostCoverImage = z.infer<typeof coverImageSchema>;

export const blogPostDefinitionSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  publishedAt: z.string().datetime({ offset: true }),
  author: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  published: z.boolean().default(true),
  coverImage: coverImageSchema.optional(),
});

export const blogPostSchema = blogPostDefinitionSchema.extend({
  slug: blogSlugSchema,
  href: blogHrefSchema,
});

export type BlogPostDefinition = z.infer<typeof blogPostDefinitionSchema>;
export type BlogPost = z.infer<typeof blogPostSchema>;
