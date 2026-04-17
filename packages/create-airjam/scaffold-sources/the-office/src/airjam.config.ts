/**
 * Air Jam app config for the-office.
 *
 * `input.behavior.latest` makes `action` a held button (continuous latest
 * value) instead of the default tap-safe pulse. The rest of the runtime
 * topology is resolved from Vite env vars.
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
    behavior: {
      latest: ["action"],
    },
  },
});
