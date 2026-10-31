import { defineAirJamGame } from "@air-jam/sdk/core";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { pongAssets } from "./game/assets";
import { agentContract } from "./game/contracts/agent";
import { pongInput, pongInputBindings } from "./game/contracts/input";
import { pongSimulation } from "./game/engine/pong-simulation";
import { pongStore } from "./game/stores/pong-store";
import { pongTheme } from "./game/theme";

import { pongSettings } from "./game/contracts/settings";

export const airjam = defineAirJamGame({
  assets: pongAssets,
  theme: pongTheme,
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
  settings: pongSettings,
  stores: [pongStore],
  simulation: pongSimulation,
  agent: agentContract,
  testing: "./testing/profiles.ts",
  input: pongInput,
  inputBindings: pongInputBindings,
});
