import { z } from "zod";

const tokenSchema = z
  .string()
  .regex(/^[a-z][a-zA-Z0-9]*$/, "Use lower camel case token ids.");
const colorSchema = z
  .string()
  .regex(
    /^(?:#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})|(?:rgb|rgba|hsl|oklch)\((?:(?:[+-]?(?:\d*\.)?\d+(?:%|deg|grad|rad|turn)?)|[,/\s])+\))$/i,
    "Use a CSS hex, rgb(), rgba(), hsl() or oklch() colour.",
  );
const fontSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !/[;{}<>\\]/.test(value) &&
      Array.from(value).every((character) => character.charCodeAt(0) >= 32),
    "Use a CSS font-family list.",
  );
export const airJamThemeSchema = z
  .object({
    colors: z.record(tokenSchema, colorSchema),
    fonts: z.record(tokenSchema, fontSchema),
  })
  .strict();
export type AirJamTheme = z.infer<typeof airJamThemeSchema>;
export function defineAirJamTheme<Theme extends AirJamTheme>(
  theme: Theme,
): Theme {
  airJamThemeSchema.parse(theme);
  return Object.freeze(theme);
}
