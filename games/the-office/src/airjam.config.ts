import { defineAirJamGame } from "@air-jam/sdk/core";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { agentContract } from "./game/contracts/agent";
import { officeInput, officeInputBindings } from "./game/contracts/input";
import { officeSimulation } from "./game/engine/office-simulation";
import { spaceStore } from "./game/stores/space-store";

export const airjam = defineAirJamGame({
  metadata: defineAirJamGameMetadata({
    slug: "the-office",
    name: "The Office",
    tagline:
      "Workplace co-op chaos where players coordinate on pending tasks before time runs out.",
    category: "party",
    minPlayers: 1,
    maxPlayers: 4,
    inputModalities: ["buttons", "joystick", "touch"],
    supportedSdkRange: "^1.0.0",
    maintainer: { name: "Air Jam" },
    ageRating: "all-ages",
    tags: ["co-op", "workplace", "party"],
  }),
  controllerPath: "/controller",
  stores: [spaceStore],
  simulation: officeSimulation,
  agent: agentContract,
  testing: "./testing/profiles.ts",
  input: officeInput,
  inputBindings: officeInputBindings,
});
