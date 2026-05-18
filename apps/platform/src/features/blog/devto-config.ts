import { z } from "zod";

const devtoTagPattern = /^[a-z0-9]+$/;

export const devtoConfigSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  tags: z.array(z.string().regex(devtoTagPattern)).min(1).max(4),
  coverImage: z.string().min(1).optional(),
  published: z.boolean().default(false),
});

export type DevtoConfig = z.input<typeof devtoConfigSchema>;
