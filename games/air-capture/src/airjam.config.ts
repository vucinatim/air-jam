/**
 * Air Jam app config for air-capture.
 *
 * See `airjam.config.ts` in the pong template for a minimal reference. The
 * advanced bits here are the input-schema behaviors (declared in the Zod
 * schema in `./game/types`) and the deeper runtime wiring in `./host` and
 * `./controller`. Everything authoritative about the game state lives in
 * the stores under `./game/stores/`.
 */
import { createAirJamApp, env } from "@air-jam/sdk";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { gameInputSchema } from "./game/types";

export const gameMetadata = defineAirJamGameMetadata({
  slug: "air-capture",
  name: "Air Capture",
  tagline:
    "Advanced 3D arena battler with ships, rockets, flags, physics, bots, and remote audio.",
  category: "arcade",
  minPlayers: 1,
  maxPlayers: 4,
  inputModalities: ["buttons", "joystick", "touch"],
  supportedSdkRange: "^1.0.0",
  maintainer: { name: "Air Jam" },
  ageRating: "all-ages",
  tags: ["3d", "physics", "capture-the-flag"],
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: {
    controllerPath: "/controller",
    machine: {
      visualScenariosModule: "../visual/scenarios.ts",
    },
  },
  input: {
    schema: gameInputSchema,
  },
});
