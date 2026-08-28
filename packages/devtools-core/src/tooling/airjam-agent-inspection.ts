import path from "node:path";
import { runCommandResult } from "../commands.js";
import {
  resolveDevtoolsHelperScript,
  resolveTsxCliPath,
} from "../helper-scripts.js";

type AirJamAgentInspection = {
  hasAgent: boolean;
  visualScenariosModulePath: string | null;
};

const parseHelperJson = <T>(output: string): T => {
  const startIndex = output.indexOf("{");
  const endIndex = output.lastIndexOf("}");
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Expected JSON helper output but received:\n${output}`);
  }

  return JSON.parse(output.slice(startIndex, endIndex + 1)) as T;
};

export const inspectAirJamAgentConfig = async (
  configPath: string,
): Promise<AirJamAgentInspection> => {
  const result = runCommandResult({
    command: process.execPath,
    args: [
      resolveTsxCliPath(),
      resolveDevtoolsHelperScript("inspect-airjam-agent.ts"),
      "--config",
      configPath,
    ],
    cwd: path.dirname(configPath),
  });

  if (!result.ok) {
    throw new Error(
      `Air Jam agent config helper failed.\n\n${result.stderr || result.stdout}`,
    );
  }

  return parseHelperJson<AirJamAgentInspection>(result.stdout);
};
