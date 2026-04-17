import { z } from "zod";

/**
 * Canonical Zod schema for the `games.config` JSONB column.
 *
 * Intentionally narrow at v1. Add fields here as real creator needs surface —
 * every addition forces a schema change that all read/write paths must honor,
 * which prevents the long-tail JSON drift that was the original concern.
 *
 * Write paths must call `parseGameConfig` before persisting.
 * Read paths can trust the type, but should still tolerate legacy rows that
 * predate any added field (use `.optional()` for new fields).
 */
export const gameConfigSchema = z
  .object({
    // Reserved for future fields. The empty-object baseline is intentional:
    // it forces an explicit schema decision for every field added here
    // instead of allowing arbitrary JSON to accumulate.
  })
  .strict();

export type GameConfig = z.infer<typeof gameConfigSchema>;

export const DEFAULT_GAME_CONFIG: GameConfig = Object.freeze({});

/**
 * Parse arbitrary input into a validated `GameConfig`.
 *
 * Throws a ZodError if the input does not match the schema. Callers at the
 * tRPC boundary should surface this as a `BAD_REQUEST` to the creator.
 */
export const parseGameConfig = (value: unknown): GameConfig =>
  gameConfigSchema.parse(value);

/**
 * Lenient variant for read paths that might encounter legacy rows. Returns the
 * empty config if the stored value fails validation, rather than throwing.
 */
export const parseGameConfigLenient = (value: unknown): GameConfig => {
  const result = gameConfigSchema.safeParse(value);
  return result.success ? result.data : DEFAULT_GAME_CONFIG;
};
