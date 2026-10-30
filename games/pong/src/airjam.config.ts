import { defineAirJamGame } from "@air-jam/sdk/core";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { agentContract } from "./game/contracts/agent";
import { pongInput, pongInputBindings } from "./game/contracts/input";
import { pongSimulation } from "./game/engine/pong-simulation";
import { pongStore } from "./game/stores/pong-store";

export const airjam = defineAirJamGame({
  metadata: defineAirJamGameMetadata({
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
  }),
  controllerPath: "/controller",
  stores: [pongStore],
  simulation: pongSimulation,
  agent: agentContract,
  testing: "./testing/profiles.ts",
  input: pongInput,
  inputBindings: pongInputBindings,
});
