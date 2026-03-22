import { createAirJamApp, env } from "@air-jam/sdk";
import { gameInputSchema } from "./game/types";

export const airjam = createAirJamApp({
  runtime: env.vite(),
  game: {
    controllerPath: "/controller",
  },
  input: {
    schema: gameInputSchema,
  },
});
