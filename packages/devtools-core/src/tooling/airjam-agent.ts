import type {
  AnyAirJamAgentContract,
  AnyVisualHarnessBridgeDefinition,
  VisualScenarioPack,
} from "@air-jam/harness/visual";
import type { AirJamAgentContract, AirJamApp } from "@air-jam/sdk";
import path from "node:path";
import { pathToFileURL } from "node:url";

type AirJamConfigModule = {
  airjam?: AirJamApp;
  default?: AirJamApp;
};

const readPublishedAgent = (
  airjam: AirJamApp,
): {
  agent: AirJamAgentContract | null;
  visualScenariosModule: string | null;
} => ({
  agent: airjam.agent ?? null,
  visualScenariosModule: airjam.visualScenariosModule ?? null,
});

const isVisualScenarioPack = (
  value: unknown,
): value is VisualScenarioPack<
  AnyAirJamAgentContract,
  AnyVisualHarnessBridgeDefinition | null
> =>
  Boolean(
    value &&
    typeof value === "object" &&
    "agent" in (value as Record<string, unknown>) &&
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

export const loadAgentContractFromConfig = async (
  configPath: string,
): Promise<AirJamAgentContract> => {
  const airjam = await loadAirJamAppConfig(configPath);
  const contract = readPublishedAgent(airjam).agent;

  if (!contract) {
    throw new Error(`Air Jam config "${configPath}" does not publish agent.`);
  }

  return contract;
};

export const resolveVisualScenarioModulePathFromConfig = async (
  configPath: string,
): Promise<string | null> => {
  const airjam = await loadAirJamAppConfig(configPath);
  const moduleSpecifier = readPublishedAgent(airjam).visualScenariosModule;

  if (!moduleSpecifier) {
    return null;
  }

  if (typeof moduleSpecifier !== "string" || moduleSpecifier.trim() === "") {
    throw new Error(
      `Air Jam config "${configPath}" exports an invalid visualScenariosModule value.`,
    );
  }

  return path.resolve(path.dirname(configPath), moduleSpecifier);
};

export const loadVisualScenarioPackFromConfig = async (
  configPath: string,
): Promise<
  VisualScenarioPack<
    AnyAirJamAgentContract,
    AnyVisualHarnessBridgeDefinition | null
  >
> => {
  const modulePath =
    await resolveVisualScenarioModulePathFromConfig(configPath);
  if (!modulePath) {
    throw new Error(
      `Air Jam config "${configPath}" does not publish visualScenariosModule.`,
    );
  }

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

  if (!isVisualScenarioPack(scenarioPack)) {
    throw new Error(
      `Air Jam visual scenarios module "${modulePath}" does not export a valid scenario pack.`,
    );
  }

  return scenarioPack;
};
