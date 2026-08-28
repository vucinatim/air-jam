import type { AnyAirJamAgentContract } from "@air-jam/sdk";
import type { VisualScenario, VisualScenarioPack } from "./types.js";

export const defineVisualScenarios = <
  TAgent extends AnyAirJamAgentContract,
>(pack: {
  agent: TAgent;
  scenarios: ReadonlyArray<VisualScenario<TAgent>>;
}): VisualScenarioPack<TAgent> => pack;
