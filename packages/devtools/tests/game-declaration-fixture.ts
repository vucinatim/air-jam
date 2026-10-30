import type { AirJamGameMetadata } from "@air-jam/sdk/metadata";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  defineAirJamTesting,
  type AirJamPlayerContract,
  type AirJamTestProfile,
} from "../src/testing.js";

export const fixtureMetadata = (
  overrides: Partial<AirJamGameMetadata> = {},
): AirJamGameMetadata => ({
  version: 1,
  slug: "fixture-game",
  name: "Fixture Game",
  tagline: "Fixture",
  category: "arcade",
  minPlayers: 1,
  maxPlayers: 4,
  inputModalities: ["buttons"],
  supportedSdkRange: "^1.0.0",
  maintainer: { name: "Air Jam" },
  ...overrides,
});
const coreUrl = pathToFileURL(
  fileURLToPath(new URL("../../sdk/dist/core.js", import.meta.url)),
).href;
const testingUrl = new URL("../src/testing.ts", import.meta.url).href;
export const declarationSource = (
  metadata: Partial<AirJamGameMetadata> = {},
  fields = "",
  imports = "",
) =>
  `import { defineAirJamGame } from ${JSON.stringify(coreUrl)};\n${imports}\nexport const airjam = defineAirJamGame({ metadata: ${JSON.stringify(fixtureMetadata(metadata))}, ${fields} });\n`;
export const testingSource = (fields: string) =>
  `import { defineAirJamTesting } from ${JSON.stringify(testingUrl)};\nexport const testing = defineAirJamTesting({${fields}});\n`;
export const fixtureProfile: AirJamTestProfile = {
  label: "Fixture",
  seats: [{ id: "first", label: "First" }],
  setup: [],
  actions: [],
  scope: "diagnostic",
  includeImage: false,
  timing: { intervalMs: 20, decisionMs: 50, inputTtlMs: 100 },
  metrics: [],
  policies: {},
  evaluator: { create: () => ({ evaluate: () => ({ status: "pending" }) }) },
};
export const declaredModelPolicy = (player: AirJamPlayerContract) => {
  const policy = defineAirJamTesting({
    player,
    profiles: { fixture: fixtureProfile },
  }).profiles.fixture.policies.model;
  if (!policy)
    throw new Error("The declared player must offer a model policy.");
  return policy;
};
