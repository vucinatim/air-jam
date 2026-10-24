/**
 * Air Jam app config.
 *
 * Declares the runtime topology and the controller sub-route. `env.vite(...)`
 * resolves topology from `VITE_AIR_JAM_*` env vars; see `.env.example`.
 *
 * This minimal template declares no controls: taps are dispatched as store
 * actions. For continuous controls (stick, paddle), declare them with
 * `defineAirJamInput` and read them in a simulation, as the pong template does.
 */
import { createAirJamApp, env } from "@air-jam/sdk";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { agentContract } from "./game/contracts/agent";
import { minimalStore } from "./game/store";

export const gameMetadata = defineAirJamGameMetadata({
  slug: "minimal",
  name: "Minimal",
  tagline:
    "Clean-slate starter with a shared tap counter in a tiny code surface.",
  category: "showcase",
  minPlayers: 1,
  maxPlayers: 4,
  inputModalities: ["buttons", "touch"],
  supportedSdkRange: "^1.0.0",
  maintainer: { name: "Air Jam" },
  ageRating: "all-ages",
  tags: ["starter", "minimal", "counter"],
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  metadata: gameMetadata,
  controllerPath: "/controller",
  stores: [minimalStore],
  agent: agentContract,
  testing: "./testing/profiles.ts",
});
