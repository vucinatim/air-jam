import { defineAirJamGame } from "@air-jam/sdk/core";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { agentContract } from "./game/contracts/agent";
import {
  airCaptureInput,
  airCaptureInputBindings,
} from "./game/contracts/input";
import { prototypeMatchStore } from "./game/stores/match/match-store";

export const airjam = defineAirJamGame({
  metadata: defineAirJamGameMetadata({
    slug: "air-capture",
    name: "Air Capture",
    tagline:
      "Advanced 3D arena battler with ships, rockets, flags, physics, bots, and remote audio.",
    category: "arcade",
    minPlayers: 1,
    maxPlayers: 4,
    inputModalities: ["buttons", "joystick", "touch"],
    supportedSdkRange: "^1.0.0",
    maintainer: { name: "Air Jam" },
    ageRating: "all-ages",
    tags: ["3d", "physics", "capture-the-flag"],
  }),
  controllerPath: "/controller",
  stores: [prototypeMatchStore],
  // Loaded on the host only: it brings the Rapier physics engine.
  simulation: () =>
    import("./game/simulation/air-capture-simulation").then(
      (module) => module.airCaptureSimulation,
    ),
  agent: agentContract,
  testing: "./testing/profiles.ts",
  input: airCaptureInput,
  inputBindings: airCaptureInputBindings,
});
