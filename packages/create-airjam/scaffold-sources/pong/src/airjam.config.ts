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
 *
 * Add optional `metadata` here once you have a typed catalog shape to target.
 */
import { createAirJamApp, env } from "@air-jam/sdk";
import { gameInputSchema } from "./game/input";

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: {
    controllerPath: "/controller",
  },
  input: {
    schema: gameInputSchema,
  },
});
