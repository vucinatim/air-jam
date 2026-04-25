import { inspectProject } from "@air-jam/devtools-core";
import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  AirJamProjectLocalMcpConfig,
  InspectMcpProjectSetupResult,
} from "./types.js";

export const AIRJAM_PROJECT_MCP_FILE = ".mcp.json";

export const createProjectLocalMcpConfig = (): AirJamProjectLocalMcpConfig => ({
  mcpServers: {
    airjam: {
      command: "pnpm",
      args: ["exec", "airjam-mcp"],
    },
  },
});

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const inspectMcpProjectSetup = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<InspectMcpProjectSetupResult> => {
  const project = await inspectProject({ cwd });
  const configPath = path.join(
    project.context.rootDir,
    AIRJAM_PROJECT_MCP_FILE,
  );

  return {
    projectDir: project.context.rootDir,
    configPath,
    hasConfigFile: await pathExists(configPath),
    hasMcpScript: Boolean(project.scripts.mcp),
    hasMcpDependency: Boolean(project.airJamPackages["@air-jam/mcp-server"]),
    recommendedConfig: createProjectLocalMcpConfig(),
  };
};

export const writeProjectLocalMcpConfig = async ({
  cwd = process.cwd(),
  force = false,
}: {
  cwd?: string;
  force?: boolean;
} = {}): Promise<InspectMcpProjectSetupResult> => {
  const inspection = await inspectMcpProjectSetup({ cwd });

  if (inspection.hasConfigFile && !force) {
    throw new Error(
      `MCP config already exists at ${inspection.configPath}. Re-run with force to overwrite it.`,
    );
  }

  await mkdir(path.dirname(inspection.configPath), { recursive: true });
  await writeFile(
    inspection.configPath,
    `${JSON.stringify(inspection.recommendedConfig, null, 2)}\n`,
    "utf8",
  );

  return inspectMcpProjectSetup({ cwd });
};
