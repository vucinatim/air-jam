import { z } from "zod";

/**
 * Canonical game metadata contract.
 *
 * This is the typed shape a creator declares once for their game. The platform
 * and Arcade consume it to render catalog entries, validate compatibility, and
 * (later) power filtering, moderation, and recommendation.
 *
 * Scope is intentionally narrow at v1. Additions require a schema change so
 * consumers can keep assuming the shape is stable. External creators should be
 * able to target this contract before the first third-party catalog submission.
 *
 * This contract is distinct from `@air-jam/sdk/capabilities` — capabilities
 * describe what a game exposes at runtime (actions, state, evaluation seams);
 * metadata describes what the catalog needs to present the game.
 */

/** Broad taxonomy for catalog filtering and landing-page grouping. */
export const GAME_CATEGORIES = [
  "party",
  "arcade",
  "puzzle",
  "music",
  "sports",
  "strategy",
  "creative",
  "showcase",
  "other",
] as const;

export type AirJamGameCategory = (typeof GAME_CATEGORIES)[number];

/** How the controller is expected to be used. Multi-select, at least one entry. */
export const GAME_INPUT_MODALITIES = [
  "buttons",
  "joystick",
  "touch",
  "motion",
  "text",
  "audio",
] as const;

export type AirJamGameInputModality = (typeof GAME_INPUT_MODALITIES)[number];

const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: "slug must be lowercase kebab-case (e.g. `my-cool-game`)",
  });

const playerCountSchema = z.number().int().min(1).max(16);

// Accept any npm-style semver range (e.g. "^1.0.0", ">=1.2 <2", "1.x"). We do
// not resolve it here — consumers like the platform will compare against the
// live SDK version at listing/build time.
const semverRangeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\^~<>=\d][\d\w\s.\-+<>=^~|*x]*$/, {
    message: "supportedSdkRange must be a valid semver range",
  });

const maintainerSchema = z.object({
  name: z.string().min(1).max(80),
  handle: z.string().min(1).max(80).optional(),
  url: z.string().url().max(500).optional(),
});

export type AirJamGameMaintainer = z.infer<typeof maintainerSchema>;

export const airJamGameMetadataSchema = z
  .object({
    /** Fixed identifier for the contract version. Lets us evolve safely later. */
    version: z.literal(1).default(1),
    /** Stable URL-safe slug. */
    slug: slugSchema,
    /** Human-readable display name shown in the catalog. */
    name: z.string().min(1).max(80),
    /** One- to two-sentence description for catalog cards. Keep under ~240 chars. */
    tagline: z.string().min(1).max(240),
    /** Broad taxonomy category. Use `other` sparingly. */
    category: z.enum(GAME_CATEGORIES),
    /** Inclusive minimum player count. */
    minPlayers: playerCountSchema,
    /** Inclusive maximum player count. */
    maxPlayers: playerCountSchema,
    /** At least one input modality the controller uses. */
    inputModalities: z
      .array(z.enum(GAME_INPUT_MODALITIES))
      .min(1)
      .max(GAME_INPUT_MODALITIES.length),
    /** Semver range of `@air-jam/sdk` this game is known to run against. */
    supportedSdkRange: semverRangeSchema,
    /** The person or team responsible for this game. */
    maintainer: maintainerSchema,
    /** Optional content advisory for age-sensitive catalog sorting. */
    ageRating: z.enum(["all-ages", "teen", "mature"]).optional(),
    /** Optional short list of keyword tags for search. */
    tags: z.array(z.string().min(1).max(32)).max(12).optional(),
  })
  .refine((value) => value.minPlayers <= value.maxPlayers, {
    message: "minPlayers must be <= maxPlayers",
    path: ["minPlayers"],
  });

export type AirJamGameMetadata = z.infer<typeof airJamGameMetadataSchema>;

export type DefineAirJamGameMetadataInput = Omit<
  z.input<typeof airJamGameMetadataSchema>,
  "version"
> & {
  version?: 1;
};

/**
 * Validate and freeze a metadata object. Throws `ZodError` on invalid input.
 *
 * Call this once in `airjam.config.ts` (or the equivalent entry for your game)
 * so the shape is checked at build time instead of at catalog ingestion.
 */
export const defineAirJamGameMetadata = (
  input: DefineAirJamGameMetadataInput,
): AirJamGameMetadata =>
  Object.freeze(
    airJamGameMetadataSchema.parse({
      version: 1,
      ...input,
    }),
  );

/**
 * Lenient parser for read-side consumption (e.g. the platform reading stored
 * metadata). Returns a `{ ok, data } | { ok, error }` discriminated result so
 * the caller can surface validation failures without throwing.
 */
export const parseAirJamGameMetadata = (
  value: unknown,
):
  | { ok: true; data: AirJamGameMetadata }
  | { ok: false; error: z.ZodError } => {
  const result = airJamGameMetadataSchema.safeParse(value);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, error: result.error };
};
