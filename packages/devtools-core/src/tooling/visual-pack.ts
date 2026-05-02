import type {
  AnyAirJamAgentContract,
  AnyVisualHarnessBridgeDefinition,
  VisualScenarioPack,
} from "@air-jam/harness/visual";
import { pathToFileURL } from "node:url";
import { loadVisualScenarioPackFromConfig } from "./airjam-agent.js";

export const loadVisualScenarioPack = async (
  modulePath: string,
): Promise<
  VisualScenarioPack<
    AnyAirJamAgentContract,
    AnyVisualHarnessBridgeDefinition | null
  >
> => {
  const loaded = (await import(pathToFileURL(modulePath).href)) as {
    visualHarness?: VisualScenarioPack<
      AnyAirJamAgentContract,
      AnyVisualHarnessBridgeDefinition | null
    >;
    visualScenarios?: VisualScenarioPack<
      AnyAirJamAgentContract,
      AnyVisualHarnessBridgeDefinition | null
    >;
    harness?: VisualScenarioPack<
      AnyAirJamAgentContract,
      AnyVisualHarnessBridgeDefinition | null
    >;
  };

  const scenarioPack =
    loaded.visualHarness ?? loaded.visualScenarios ?? loaded.harness ?? null;

  if (
    !scenarioPack ||
    !scenarioPack.agent ||
    !Array.isArray(scenarioPack.scenarios)
  ) {
    throw new Error(`Invalid Air Jam visual scenario pack at ${modulePath}.`);
  }

  return scenarioPack;
};

export const loadVisualScenarioPackFromModuleOrConfig = async ({
  modulePath,
  configPath,
}: {
  modulePath?: string | null;
  configPath?: string | null;
}): Promise<
  VisualScenarioPack<
    AnyAirJamAgentContract,
    AnyVisualHarnessBridgeDefinition | null
  >
> => {
  if (configPath) {
    return loadVisualScenarioPackFromConfig(configPath);
  }

  if (modulePath) {
    return loadVisualScenarioPack(modulePath);
  }

  throw new Error(
    "Missing visual scenario source. Expected --config or --module-path.",
  );
};
