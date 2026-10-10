import { createAirJamApp, defineAirJamAgentContract } from "@air-jam/sdk";

export const agent = defineAirJamAgentContract({
  stores: {},
  projectSnapshot: () => ({ ready: true }),
  actions: {},
});

export const airjam = Object.assign(createAirJamApp({ agent }), {
  visualScenariosModule: "./visual-scenarios.ts",
});
