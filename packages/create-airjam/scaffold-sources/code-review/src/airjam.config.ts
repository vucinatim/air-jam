/**
 * Air Jam app config for code-review.
 *
 * `input.behavior.latest` makes the `defend` field behave as a continuous
 * latest value (good for a held button) instead of the default one-shot
 * pulse. See `@air-jam/sdk` docs for the full behavior matrix.
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
      latest: ["defend"],
    },
  },
});
