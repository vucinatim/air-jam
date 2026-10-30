import { defineAirJamGame } from "@air-jam/sdk/core";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { agentContract } from "./game/contracts/agent";
import { roundClock } from "./game/engine/round-clock";
import { gameStore } from "./game/stores/create-store";

export const airjam = defineAirJamGame({
  metadata: defineAirJamGameMetadata({
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
  }),
  controllerPath: "/controller",
  stores: [gameStore],
  simulation: roundClock,
  agent: agentContract,
});
