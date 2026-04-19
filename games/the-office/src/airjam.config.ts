/**
 * Air Jam app config for the-office.
 *
 * `input.behavior.latest` makes `action` a held button (continuous latest
 * value) instead of the default tap-safe pulse. The rest of the runtime
 * topology is resolved from Vite env vars.
 */
import { createAirJamApp, env } from "@air-jam/sdk";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { gameInputSchema } from "./game/input";

export const gameMetadata = defineAirJamGameMetadata({
  slug: "the-office",
  name: "The Office",
  tagline:
    "Workplace co-op chaos where players coordinate on pending tasks before time runs out.",
  category: "party",
  minPlayers: 1,
  maxPlayers: 4,
  inputModalities: ["buttons", "joystick", "touch"],
  supportedSdkRange: "^1.0.0",
  maintainer: { name: "Air Jam" },
  ageRating: "all-ages",
  tags: ["co-op", "workplace", "party"],
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
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
