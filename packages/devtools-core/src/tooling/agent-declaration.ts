import path from "node:path";
import { loadAirJamAppConfig } from "./airjam-agent.js";

export type AirJamAgentDeclaration = {
  hasAgent: boolean;
  visualScenariosModulePath: string | null;
};

export const inspectAirJamAgentDeclaration = async (
  configPath: string,
): Promise<AirJamAgentDeclaration> => {
  const airjam = await loadAirJamAppConfig(configPath);
  const moduleSpecifier = airjam.visualScenariosModule ?? null;

  if (
    moduleSpecifier !== null &&
    (typeof moduleSpecifier !== "string" || moduleSpecifier.trim() === "")
  ) {
    throw new Error(
      `Air Jam config "${configPath}" exports an invalid visualScenariosModule value.`,
    );
  }

  return {
    hasAgent: Boolean(airjam.agent),
    visualScenariosModulePath:
      typeof moduleSpecifier === "string"
        ? path.resolve(path.dirname(configPath), moduleSpecifier)
        : null,
  };
};
