/**
 * Air Jam app config.
 *
 * This is where the SDK picks up your runtime topology, your controller path,
 * and the controls each player has.
 *
 * - `runtime`: `env.vite(import.meta.env)` resolves topology from Vite-exposed
 *    env vars (see README). For Next.js templates swap to `env.next(...)`.
 * - `game.controllerPath`: the sub-route that phones visit. The QR code on
 *    the host encodes `<origin>/<controllerPath>?room=<roomId>`.
 * - `input`: the declared controls. Phone controls fill them and the
 *    simulation reads them each step through `input(playerId)`.
 */
import { createAirJamApp, env } from "@air-jam/sdk";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { agentContract } from "./game/contracts/agent";
import { pongInput } from "./game/contracts/input";
import { pongSimulation } from "./game/engine/pong-simulation";
import { pongStore } from "./game/stores/pong-store";

export const gameMetadata = defineAirJamGameMetadata({
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
});

export const airjam = createAirJamApp({
  runtime: env.vite(import.meta.env),
  metadata: gameMetadata,
  controllerPath: "/controller",
  stores: [pongStore],
  simulation: pongSimulation,
  agent: agentContract,
  testing: "./testing/profiles.ts",
  input: pongInput,
});
