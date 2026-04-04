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
