import path from "node:path";
import { loadAirJamAppConfig } from "./airjam-machine.js";

export type AirJamMachineDeclaration = {
  hasAgent: boolean;
  visualScenariosModulePath: string | null;
};

export const inspectAirJamMachineDeclaration = async (
  configPath: string,
): Promise<AirJamMachineDeclaration> => {
  const airjam = await loadAirJamAppConfig(configPath);
  const moduleSpecifier = airjam.game.visualScenariosModule ?? null;

  if (
    moduleSpecifier !== null &&
    (typeof moduleSpecifier !== "string" || moduleSpecifier.trim() === "")
  ) {
    throw new Error(
      `Air Jam config "${configPath}" exports an invalid game.visualScenariosModule value.`,
    );
  }

  return {
    hasAgent: Boolean(airjam.game.agent),
    visualScenariosModulePath:
      typeof moduleSpecifier === "string"
        ? path.resolve(path.dirname(configPath), moduleSpecifier)
        : null,
  };
};
