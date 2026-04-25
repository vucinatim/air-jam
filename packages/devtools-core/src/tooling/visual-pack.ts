import type {
  AnyVisualHarnessBridgeDefinition,
  VisualScenarioPack,
} from "@air-jam/harness";
import { pathToFileURL } from "node:url";
import { loadVisualScenarioPackFromConfig } from "./airjam-machine.js";

export const loadVisualScenarioPack = async (
  modulePath: string,
): Promise<VisualScenarioPack<AnyVisualHarnessBridgeDefinition>> => {
  const loaded = (await import(pathToFileURL(modulePath).href)) as {
    visualHarness?: VisualScenarioPack<AnyVisualHarnessBridgeDefinition>;
    visualScenarios?: VisualScenarioPack<AnyVisualHarnessBridgeDefinition>;
    harness?: VisualScenarioPack<AnyVisualHarnessBridgeDefinition>;
  };

  const scenarioPack =
    loaded.visualHarness ?? loaded.visualScenarios ?? loaded.harness ?? null;

  if (
    !scenarioPack ||
    typeof scenarioPack.gameId !== "string" ||
    !scenarioPack.bridge ||
    scenarioPack.bridge.gameId !== scenarioPack.gameId ||
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
}): Promise<VisualScenarioPack<AnyVisualHarnessBridgeDefinition>> => {
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
