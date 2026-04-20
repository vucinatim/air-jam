/**
 * Air Jam app config for code-review.
 *
 * `input.behavior.latest` makes the `defend` field behave as a continuous
 * latest value (good for a held button) instead of the default one-shot
 * pulse. See `@air-jam/sdk` docs for the full behavior matrix.
 */
import { createAirJamApp, env } from "@air-jam/sdk";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { gameInputSchema } from "./game/contracts/input";

export const gameMetadata = defineAirJamGameMetadata({
  slug: "code-review",
  name: "Code Review",
  tagline:
    "2D fighting arena with gyroscope controls and code-review-themed team brawling.",
  category: "arcade",
  minPlayers: 1,
  maxPlayers: 4,
  inputModalities: ["buttons", "motion", "touch"],
  supportedSdkRange: "^1.0.0",
  maintainer: { name: "Air Jam" },
  ageRating: "all-ages",
  tags: ["fighting", "teams", "motion"],
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: {
    controllerPath: "/controller",
  },
  input: {
    schema: gameInputSchema,
    behavior: {
      latest: ["defend"],
    },
  },
});
