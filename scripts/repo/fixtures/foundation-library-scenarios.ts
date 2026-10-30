import { defineVisualScenarios } from "@air-jam/devtools/harness/visual";
import { defineAirJamTesting } from "@air-jam/devtools/testing";

export const testing = defineAirJamTesting({
  profiles: {},
  visual: defineVisualScenarios({
    scenarios: [{ id: "installed-library", run: async () => {} }],
  }),
});
