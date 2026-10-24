/**
 * Air Jam app config for air-capture.
 *
 * See `airjam.config.ts` in the pong template for a minimal reference. The
 * advanced bits here are the input-schema behaviors (declared in
 * `./game/contracts/input`) and the deeper runtime wiring in `./host` and
 * `./controller`. Everything authoritative about the game state lives in
 * the stores under `./game/stores/`.
 */
import { createAirJamApp, env } from "@air-jam/sdk";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { agentContract } from "./game/contracts/agent";
import {
  airCaptureInput,
  airCaptureInputBindings,
} from "./game/contracts/input";
import { prototypeMatchStore } from "./game/stores/match/match-store";

export const gameMetadata = defineAirJamGameMetadata({
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
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  metadata: gameMetadata,
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
