import type {
  AnyAirJamAgentContract,
  VisualScenarioPack,
} from "@air-jam/harness/visual";
import { pathToFileURL } from "node:url";
import { loadVisualScenarioPackFromConfig } from "./airjam-agent.js";

export const loadVisualScenarioPack = async (
  modulePath: string,
): Promise<VisualScenarioPack<AnyAirJamAgentContract>> => {
  const loaded = (await import(pathToFileURL(modulePath).href)) as {
    visualScenarios?: VisualScenarioPack<AnyAirJamAgentContract>;
  };

  const scenarioPack = loaded.visualScenarios ?? null;

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
}): Promise<VisualScenarioPack<AnyAirJamAgentContract>> => {
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
