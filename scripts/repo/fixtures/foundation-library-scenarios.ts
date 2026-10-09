import { defineVisualScenarios } from "@air-jam/devtools/harness/visual";
import { agent } from "./airjam.config.js";

export const visualScenarios = defineVisualScenarios({
  agent,
  scenarios: [{ id: "installed-library", run: async () => {} }],
});
