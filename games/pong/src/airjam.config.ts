/**
 * Air Jam app config.
 *
 * This is where the SDK picks up your runtime topology, your controller path,
 * and the Zod schema that controllers use to publish input to the host.
 *
 * - `runtime`: `env.vite(import.meta.env)` resolves topology from Vite-exposed
 *    env vars (see README). For Next.js templates swap to `env.next(...)`.
 * - `game.controllerPath`: the sub-route that phones visit. The QR code on
 *    the host encodes `<origin>/<controllerPath>?room=<roomId>`.
 * - `input.schema`: the Zod shape your controller publishes. The host reads
 *    validated values through `host.getInput(playerId)`.
 */
import { createAirJamApp, env } from "@air-jam/sdk";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { gameAgentContract } from "./game/contracts/agent";
import { gameInputSchema } from "./game/contracts/input";

export const gameMetadata = defineAirJamGameMetadata({
  slug: "pong",
  name: "Pong",
  tagline:
    "Basic 2D canvas starter. Team paddle game with lobby, bots, scoring, and audio.",
  category: "arcade",
  minPlayers: 1,
  maxPlayers: 4,
  inputModalities: ["buttons", "touch"],
  supportedSdkRange: "^1.0.0",
  maintainer: { name: "Air Jam" },
  ageRating: "all-ages",
  tags: ["starter", "canvas", "teams"],
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: {
    controllerPath: "/controller",
    machine: {
      agent: gameAgentContract,
      visualScenariosModule: "../visual/scenarios.ts",
    },
  },
  input: {
    schema: gameInputSchema,
  },
});
