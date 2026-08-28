import { inspectProject } from "@air-jam/devtools-core/context";
import {
  AIRJAM_PROJECT_MCP_FILE,
  inspectMcpProjectSetup,
  renderMcpClientProfile,
  writeProjectLocalMcpConfig,
  type AirJamMcpClientProfile,
} from "@air-jam/mcp-server/config";
import kleur from "kleur";

const printConfigSnippet = (value: unknown): void => {
  console.log(JSON.stringify(value, null, 2));
};

export const runMcpDoctor = async ({
  dir,
  json = false,
}: {
  dir?: string;
  json?: boolean;
}): Promise<void> => {
  const project = await inspectProject({ cwd: dir });
  const setup = await inspectMcpProjectSetup({ cwd: dir });

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ projectMode: project.context.mode, ...setup }, null, 2)}\n`,
    );
    return;
  }

  console.log(kleur.cyan("Air Jam MCP doctor\n"));
  console.log(`Project root: ${setup.projectDir}`);
  console.log(`Project mode: ${project.context.mode}`);
  console.log(
    `MCP dependency: ${setup.package.dependencyPresent ? kleur.green("present") : kleur.yellow("missing")}`,
  );
  console.log(
    `MCP script: ${setup.package.scriptPresent ? kleur.green("present") : kleur.yellow("missing")}`,
  );
  console.log(
    `Portable declaration: ${setup.portableDeclaration.present ? kleur.green(setup.portableDeclaration.configPath) : kleur.yellow(`missing (${AIRJAM_PROJECT_MCP_FILE})`)}`,
  );
  console.log(
    `Codex registration: ${setup.clients.codex.registered ? kleur.green("present") : kleur.yellow("missing")}`,
  );
  console.log(
    `Claude Desktop registration: ${setup.clients.claudeDesktop.registered ? kleur.green("present") : kleur.yellow("missing")}`,
  );
  console.log("");
  console.log("Recommended project-local MCP config:\n");
  printConfigSnippet(setup.recommendedConfig);
};

export const runMcpInit = async ({
  dir,
  force,
  json = false,
}: {
  dir?: string;
  force?: boolean;
  json?: boolean;
}): Promise<void> => {
  const inspection = await writeProjectLocalMcpConfig({
    cwd: dir,
    force: force === true,
  });

  if (json) {
    process.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
  } else {
    console.log(
      kleur.green(
        `Wrote portable MCP declaration to ${inspection.portableDeclaration.configPath}`,
      ),
    );
  }
};

export const runMcpConfig = async ({
  dir,
  profile = "portable",
  json = false,
}: {
  dir?: string;
  profile?: AirJamMcpClientProfile;
  json?: boolean;
}): Promise<void> => {
  if (!(["portable", "codex", "claude-desktop"] as const).includes(profile)) {
    throw new Error(
      `Unknown MCP profile "${profile}". Use portable, codex, or claude-desktop.`,
    );
  }
  const setup = await inspectMcpProjectSetup({ cwd: dir });
  const rendered = renderMcpClientProfile({
    profile,
    projectDir: setup.projectDir,
  });
  process.stdout.write(
    json ? `${JSON.stringify(rendered, null, 2)}\n` : rendered.content,
  );
};
