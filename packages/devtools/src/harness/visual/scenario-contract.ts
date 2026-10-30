import type { AnyAirJamAgentContract } from "@air-jam/sdk/core";
import type { VisualScenario, VisualScenarioPack } from "./types.js";

export const defineVisualScenarios = <
  TAgent extends AnyAirJamAgentContract,
>(pack: {
  scenarios: ReadonlyArray<VisualScenario<TAgent>>;
}): VisualScenarioPack<TAgent> => pack;
