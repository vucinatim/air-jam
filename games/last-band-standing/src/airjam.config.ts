/**
 * Air Jam app config for last-band-standing.
 *
 * Overrides `maxPlayers` on top of the Vite-resolved runtime topology — this
 * game supports up to 10 concurrent phones. Players answer through store
 * actions, so the game declares no controls.
 */
import { createAirJamApp, env } from "@air-jam/sdk";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { agentContract } from "./game/contracts/agent";
import { roundClock } from "./game/engine/round-clock";
import { gameStore } from "./game/stores/create-store";

export const gameMetadata = defineAirJamGameMetadata({
  slug: "last-band-standing",
  name: "Last Band Standing",
  tagline:
    "Music-quiz party game where the host plays a clip and controllers buzz in.",
  category: "music",
  minPlayers: 2,
  maxPlayers: 10,
  inputModalities: ["buttons", "audio"],
  supportedSdkRange: "^1.0.0",
  maintainer: { name: "Air Jam" },
  ageRating: "all-ages",
  tags: ["quiz", "music", "party"],
});

export const airjam = createAirJamApp({
  runtime: {
    ...env.vite(import.meta.env),
    maxPlayers: 10,
  },
  metadata: gameMetadata,
  controllerPath: "/controller",
  stores: [gameStore],
  simulation: roundClock,
  agent: agentContract,
});
