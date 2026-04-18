/**
 * Air Jam app config.
 *
 * Declares the runtime topology, the controller sub-route, and the Zod
 * schema controllers use to publish input to the host. `env.vite(...)`
 * resolves topology from `VITE_AIR_JAM_*` env vars; see `.env.example`.
 *
 * This minimal template doesn't actually use the input lane — taps are
 * dispatched as store actions instead — so the input schema is empty. For
 * per-frame controller input (joystick, paddle), see the pong template.
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
