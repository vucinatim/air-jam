import type {
  AnyVisualHarnessBridgeDefinition,
  VisualScenarioPack,
} from "@air-jam/harness/visual";
import type { AirJamApp, AirJamGameAgentContract } from "@air-jam/sdk";
import path from "node:path";
import { pathToFileURL } from "node:url";

type AirJamConfigModule = {
  airjam?: AirJamApp;
  default?: AirJamApp;
};

const readPublishedGameMachine = (
  airjam: AirJamApp,
): {
  agent: AirJamGameAgentContract | null;
  visualScenariosModule: string | null;
} => ({
  agent: airjam.game.agent ?? null,
  visualScenariosModule: airjam.game.visualScenariosModule ?? null,
});

const isVisualScenarioPack = (
  value: unknown,
): value is VisualScenarioPack<AnyVisualHarnessBridgeDefinition> =>
  Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as { scenarios?: unknown[] }).scenarios),
  );

export const resolveAirJamConfigGameId = (airjam: AirJamApp): string | null =>
  airjam.metadata?.slug ?? null;

export const loadAirJamAppConfig = async (
  configPath: string,
): Promise<AirJamApp> => {
  const loaded = (await import(
    pathToFileURL(configPath).href
  )) as AirJamConfigModule;
  const airjam = loaded.airjam ?? loaded.default ?? null;

  if (!airjam || typeof airjam !== "object") {
    throw new Error(
      `Air Jam config module "${configPath}" does not export an airjam app config.`,
    );
  }

  return airjam;
};

export const loadGameAgentContractFromConfig = async (
  configPath: string,
): Promise<AirJamGameAgentContract> => {
  const airjam = await loadAirJamAppConfig(configPath);
  const contract = readPublishedGameMachine(airjam).agent;

  if (!contract) {
    throw new Error(
      `Air Jam config "${configPath}" does not publish game.agent.`,
    );
  }

  return contract;
};

export const resolveVisualScenarioModulePathFromConfig = async (
  configPath: string,
): Promise<string | null> => {
  const airjam = await loadAirJamAppConfig(configPath);
  const moduleSpecifier = readPublishedGameMachine(airjam).visualScenariosModule;

  if (!moduleSpecifier) {
    return null;
  }

  if (typeof moduleSpecifier !== "string" || moduleSpecifier.trim() === "") {
    throw new Error(
      `Air Jam config "${configPath}" exports an invalid game.visualScenariosModule value.`,
    );
  }

  return path.resolve(path.dirname(configPath), moduleSpecifier);
};

export const loadVisualScenarioPackFromConfig = async (
  configPath: string,
): Promise<VisualScenarioPack<AnyVisualHarnessBridgeDefinition>> => {
  const modulePath =
    await resolveVisualScenarioModulePathFromConfig(configPath);
  if (!modulePath) {
    throw new Error(
      `Air Jam config "${configPath}" does not publish game.visualScenariosModule.`,
    );
  }

  const loaded = (await import(pathToFileURL(modulePath).href)) as {
    visualHarness?: VisualScenarioPack<AnyVisualHarnessBridgeDefinition>;
    visualScenarios?: VisualScenarioPack<AnyVisualHarnessBridgeDefinition>;
    harness?: VisualScenarioPack<AnyVisualHarnessBridgeDefinition>;
  };

  const scenarioPack =
    loaded.visualHarness ?? loaded.visualScenarios ?? loaded.harness ?? null;

  if (!isVisualScenarioPack(scenarioPack)) {
    throw new Error(
      `Air Jam visual scenarios module "${modulePath}" does not export a valid scenario pack.`,
    );
  }

  return scenarioPack;
};
