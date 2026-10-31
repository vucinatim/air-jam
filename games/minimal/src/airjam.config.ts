import { defineAirJamGame } from "@air-jam/sdk/core";
import { defineAirJamGameMetadata } from "@air-jam/sdk/metadata";
import { minimalAssets } from "./game/assets";
import { agentContract } from "./game/contracts/agent";
import { minimalStore } from "./game/store";
import { minimalTheme } from "./game/theme";

export const airjam = defineAirJamGame({
  assets: minimalAssets,
  theme: minimalTheme,
  metadata: defineAirJamGameMetadata({
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
  }),
  controllerPath: "/controller",
  // No outcome settings yet: declare settings with defineAirJamSettings({}).
  stores: [minimalStore],
  agent: agentContract,
  testing: "./testing/profiles.ts",
});
