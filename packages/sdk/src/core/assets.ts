import { z } from "zod";

const publicPathSchema = z
  .string()
  .startsWith("/")
  .refine(
    (value) =>
      !value.startsWith("//") &&
      !/[?#\\%]/.test(value) &&
      !value.includes(".."),
    "Use a served public/ path without parent segments, query, hash or URL encoding.",
  );
export const soundConfigSchema = z
  .object({
    src: z.array(publicPathSchema).nonempty(),
    volume: z.number().min(0).max(1).optional(),
    loop: z.boolean().optional(),
    html5: z.boolean().optional(),
    sprite: z
      .record(
        z.string(),
        z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
      )
      .optional(),
    category: z.enum(["music", "sfx"]).optional(),
  })
  .strict();
export type SoundConfig = z.infer<typeof soundConfigSchema>;
const fileSchema = z.object({ src: publicPathSchema }).strict();
export const airJamAssetsSchema = z
  .object({
    sounds: z.record(
      z.string(),
      soundConfigSchema.extend({
        surface: z.enum(["host", "controller"]).optional(),
      }),
    ),
    images: z.record(z.string(), fileSchema),
    files: z.record(z.string(), fileSchema),
  })
  .strict();
export type AirJamAssets = z.infer<typeof airJamAssetsSchema>;
export function defineAirJamAssets<Assets extends AirJamAssets>(
  assets: Assets,
): Assets {
  airJamAssetsSchema.parse(assets);
  return Object.freeze(assets);
}
