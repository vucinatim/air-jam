import { inspectProject } from "@air-jam/devtools-core";
import {
  AIRJAM_PROJECT_MCP_FILE,
  inspectMcpProjectSetup,
  writeProjectLocalMcpConfig,
} from "@air-jam/mcp-server";
import kleur from "kleur";

const printConfigSnippet = (value: unknown): void => {
  console.log(JSON.stringify(value, null, 2));
};

export const runMcpDoctor = async ({
  dir,
}: {
  dir?: string;
}): Promise<void> => {
  const project = await inspectProject({ cwd: dir });
  const setup = await inspectMcpProjectSetup({ cwd: dir });

  console.log(kleur.cyan("Air Jam MCP doctor\n"));
  console.log(`Project root: ${setup.projectDir}`);
  console.log(`Project mode: ${project.context.mode}`);
  console.log(
    `MCP dependency: ${setup.hasMcpDependency ? kleur.green("present") : kleur.yellow("missing")}`,
  );
  console.log(
    `MCP script: ${setup.hasMcpScript ? kleur.green("present") : kleur.yellow("missing")}`,
  );
  console.log(
    `Project config: ${setup.hasConfigFile ? kleur.green(setup.configPath) : kleur.yellow(`missing (${AIRJAM_PROJECT_MCP_FILE})`)}`,
  );
  console.log("");
  console.log("Recommended project-local MCP config:\n");
  printConfigSnippet(setup.recommendedConfig);
};

export const runMcpInit = async ({
  dir,
  force,
}: {
  dir?: string;
  force?: boolean;
}): Promise<void> => {
  const inspection = await writeProjectLocalMcpConfig({
    cwd: dir,
    force: force === true,
  });

  console.log(
    kleur.green(`Wrote project-local MCP config to ${inspection.configPath}`),
  );
};

export const runMcpConfig = async ({
  dir,
}: {
  dir?: string;
}): Promise<void> => {
  const setup = await inspectMcpProjectSetup({ cwd: dir });
  printConfigSnippet(setup.recommendedConfig);
};
