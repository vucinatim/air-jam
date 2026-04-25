import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCommandResult } from "../commands.js";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

type AirJamMachineInspection = {
  hasAgent: boolean;
  visualScenariosModulePath: string | null;
};

const resolveHelperScriptPath = (fileName: string): string => {
  const builtHelperPath = path.resolve(__dirname, "tooling", fileName);
  if (existsSync(builtHelperPath)) {
    return builtHelperPath;
  }

  return path.resolve(__dirname, "..", "tooling", fileName);
};

const resolveTsxCliPath = (): string =>
  path.join(
    path.dirname(require.resolve("tsx/package.json")),
    "dist",
    "cli.mjs",
  );

const parseHelperJson = <T>(output: string): T => {
  const startIndex = output.indexOf("{");
  const endIndex = output.lastIndexOf("}");
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`Expected JSON helper output but received:\n${output}`);
  }

  return JSON.parse(output.slice(startIndex, endIndex + 1)) as T;
};

export const inspectAirJamMachineConfig = async (
  configPath: string,
): Promise<AirJamMachineInspection> => {
  const result = runCommandResult({
    command: process.execPath,
    args: [
      resolveTsxCliPath(),
      resolveHelperScriptPath("inspect-airjam-machine.ts"),
      "--config",
      configPath,
    ],
    cwd: path.dirname(configPath),
  });

  if (!result.ok) {
    throw new Error(
      `Air Jam machine config helper failed.\n\n${result.stderr || result.stdout}`,
    );
  }

  return parseHelperJson<AirJamMachineInspection>(result.stdout);
};
