/**
 * Air Jam app config for last-band-standing.
 *
 * Overrides `maxPlayers` on top of the Vite-resolved runtime topology — this
 * game supports up to 10 concurrent phones. The input schema is a simple
 * hold button declared via `input.behavior.latest`.
 */
import { createAirJamApp, env } from "@air-jam/sdk";
import { gameInputSchema } from "./game/input";

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
