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
import { gameInputSchema } from "./game/types";

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  game: {
    controllerPath: "/controller",
  },
  input: {
    schema: gameInputSchema,
  },
});
