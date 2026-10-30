import { defineAirJamAgentContract, defineAirJamGame } from "@air-jam/sdk/core";

export const agent = defineAirJamAgentContract({
  stores: {},
  projectSnapshot: () => ({ ready: true }),
  actions: {},
});

export const airjam = defineAirJamGame({
  metadata: {
    slug: "installed-library",
    name: "Installed library",
    tagline: "Installed package proof.",
    category: "party",
    minPlayers: 1,
    maxPlayers: 4,
    inputModalities: ["buttons"],
    supportedSdkRange: "^1.0.0",
    maintainer: { name: "Air Jam" },
  },
  agent,
  testing: "./visual-scenarios.ts",
});
