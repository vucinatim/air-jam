import type {
  AnyVisualHarnessBridgeDefinition,
  VisualScenarioPack,
} from "@air-jam/harness";
import type { AirJamApp, AirJamGameAgentContract } from "@air-jam/sdk";
import path from "node:path";
import { pathToFileURL } from "node:url";

type AirJamConfigModule = {
  airjam?: AirJamApp;
  default?: AirJamApp;
};

const isVisualScenarioPack = (
  value: unknown,
): value is VisualScenarioPack<AnyVisualHarnessBridgeDefinition> =>
  Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as { gameId?: unknown }).gameId === "string" &&
    typeof (value as { bridge?: { gameId?: unknown } }).bridge?.gameId ===
      "string" &&
    Array.isArray((value as { scenarios?: unknown[] }).scenarios),
  );

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
  const contract = airjam.game.machine?.agent ?? null;

  if (!contract) {
    throw new Error(
      `Air Jam config "${configPath}" does not publish game.machine.agent.`,
    );
  }

  return contract;
};

export const resolveVisualScenarioModulePathFromConfig = async (
  configPath: string,
): Promise<string | null> => {
  const airjam = await loadAirJamAppConfig(configPath);
  const moduleSpecifier = airjam.game.machine?.visualScenariosModule ?? null;

  if (!moduleSpecifier) {
    return null;
  }

  if (typeof moduleSpecifier !== "string" || moduleSpecifier.trim() === "") {
    throw new Error(
      `Air Jam config "${configPath}" exports an invalid game.machine.visualScenariosModule value.`,
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
      `Air Jam config "${configPath}" does not publish game.machine.visualScenariosModule.`,
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
