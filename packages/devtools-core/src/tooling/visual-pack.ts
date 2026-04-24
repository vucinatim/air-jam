import type {
  AnyVisualHarnessBridgeDefinition,
  VisualScenarioPack,
} from "@air-jam/harness";
import { pathToFileURL } from "node:url";

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
