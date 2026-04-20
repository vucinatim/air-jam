/**
 * Air Jam app config for last-band-standing.
 *
 * Overrides `maxPlayers` on top of the Vite-resolved runtime topology — this
 * game supports up to 10 concurrent phones. The input schema is a simple
 * hold button declared via `input.behavior.latest`.
 */
import { createAirJamApp, env } from "@air-jam/sdk";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { gameInputSchema } from "./game/contracts/input";

export const gameMetadata = defineAirJamGameMetadata({
  slug: "last-band-standing",
  name: "Last Band Standing",
  tagline:
    "Music-quiz party game where the host plays a clip and controllers buzz in.",
  category: "music",
  minPlayers: 2,
  maxPlayers: 10,
  inputModalities: ["buttons", "audio"],
  supportedSdkRange: "^1.0.0",
  maintainer: { name: "Air Jam" },
  ageRating: "all-ages",
  tags: ["quiz", "music", "party"],
});

export const airjam = createAirJamApp({
  runtime: {
    ...env.vite(import.meta.env),
    maxPlayers: 10,
  },
  game: {
    controllerPath: "/controller",
  },
  input: {
    schema: gameInputSchema,
    behavior: {
      latest: ["action"],
    },
  },
});
