import { defineAirJamGame } from "@air-jam/sdk/core";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { agentContract } from "./game/contracts/agent";
import {
  codeReviewInput,
  codeReviewInputBindings,
} from "./game/contracts/input";
import { codeReviewSimulation } from "./game/engine/code-review-simulation";
import { gameStore } from "./game/stores/code-review-store";

export const airjam = defineAirJamGame({
  metadata: defineAirJamGameMetadata({
    slug: "code-review",
    name: "Code Review",
    tagline:
      "2D team brawler with touch controls, optional tilt movement and a code-review twist.",
    category: "arcade",
    minPlayers: 1,
    maxPlayers: 4,
    inputModalities: ["buttons", "motion", "touch"],
    supportedSdkRange: "^1.0.0",
    maintainer: { name: "Air Jam" },
    ageRating: "all-ages",
    tags: ["fighting", "teams", "motion"],
  }),
  controllerPath: "/controller",
  stores: [gameStore],
  simulation: codeReviewSimulation,
  agent: agentContract,
  testing: "./testing/profiles.ts",
  input: codeReviewInput,
  inputBindings: codeReviewInputBindings,
});
