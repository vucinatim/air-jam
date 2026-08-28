import { inspectProject } from "@air-jam/devtools-core/context";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  AirJamMcpClientProfile,
  AirJamMcpClientProfileRender,
  AirJamMcpRegistrationInspection,
  AirJamMcpServerDeclaration,
  AirJamProjectLocalMcpConfig,
  InspectMcpProjectSetupResult,
} from "./types.js";

export type { AirJamMcpClientProfile } from "./types.js";

export const AIRJAM_PROJECT_MCP_FILE = ".mcp.json";
export const AIRJAM_CODEX_PROJECT_MCP_FILE = path.join(".codex", "config.toml");

export const createAirJamMcpServerDeclaration =
  (): AirJamMcpServerDeclaration => ({
    name: "airjam",
    transport: "stdio",
    command: "pnpm",
    args: ["exec", "airjam-mcp"],
  });

export const createProjectLocalMcpConfig = (): AirJamProjectLocalMcpConfig => {
  const server = createAirJamMcpServerDeclaration();
  return {
    mcpServers: {
      airjam: {
        command: server.command,
        args: [...server.args],
      },
    },
  };
};

const pathExists = async (targetPath: string): Promise<boolean> => {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const resolveClaudeDesktopConfigPath = (): string | null => {
  if (process.platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA;
    return appData
      ? path.join(appData, "Claude", "claude_desktop_config.json")
      : null;
  }
  return path.join(
    os.homedir(),
    ".config",
    "Claude",
    "claude_desktop_config.json",
  );
};

const inspectJsonRegistration = async (
  profile: AirJamMcpClientProfile,
  configPath: string | null,
): Promise<AirJamMcpRegistrationInspection> => {
  if (!configPath) {
    return { profile, configPath, configPresent: null, registered: null };
  }
  if (!(await pathExists(configPath))) {
    return { profile, configPath, configPresent: false, registered: false };
  }
  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8")) as {
      mcpServers?: Record<string, unknown>;
    };
    return {
      profile,
      configPath,
      configPresent: true,
      registered: Boolean(parsed.mcpServers?.airjam),
    };
  } catch {
    return { profile, configPath, configPresent: true, registered: false };
  }
};

const inspectCodexRegistration = async (
  projectDir: string,
): Promise<AirJamMcpRegistrationInspection> => {
  const configPath = path.join(projectDir, AIRJAM_CODEX_PROJECT_MCP_FILE);
  if (!(await pathExists(configPath))) {
    return {
      profile: "codex",
      configPath,
      configPresent: false,
      registered: false,
    };
  }
  const source = await readFile(configPath, "utf8");
  return {
    profile: "codex",
    configPath,
    configPresent: true,
    registered: /^\s*\[mcp_servers\.airjam\]\s*$/m.test(source),
  };
};

export const renderMcpClientProfile = ({
  profile,
  projectDir = process.cwd(),
}: {
  profile: AirJamMcpClientProfile;
  projectDir?: string;
}): AirJamMcpClientProfileRender => {
  const server = createAirJamMcpServerDeclaration();
  if (profile === "codex") {
    const escapedCwd = projectDir
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"');
    return {
      profile,
      format: "toml",
      scope: "project",
      configPath: path.join(projectDir, AIRJAM_CODEX_PROJECT_MCP_FILE),
      content: `[mcp_servers.airjam]\ncommand = "${server.command}"\nargs = ["exec", "airjam-mcp"]\ncwd = "${escapedCwd}"\n`,
      installCommand: `codex mcp add airjam -- ${server.command} ${server.args.join(" ")}`,
    };
  }

  return {
    profile,
    format: "json",
    scope: profile === "portable" ? "project" : "client-global",
    configPath:
      profile === "portable"
        ? path.join(projectDir, AIRJAM_PROJECT_MCP_FILE)
        : resolveClaudeDesktopConfigPath(),
    content: `${JSON.stringify(createProjectLocalMcpConfig(), null, 2)}\n`,
    installCommand:
      profile === "claude-desktop"
        ? `claude mcp add airjam -- ${server.command} ${server.args.join(" ")}`
        : null,
  };
};

export const inspectMcpProjectSetup = async ({
  cwd = process.cwd(),
}: {
  cwd?: string;
} = {}): Promise<InspectMcpProjectSetupResult> => {
  const project = await inspectProject({ cwd });
  const projectDir = project.context.rootDir;
  const configPath = path.join(projectDir, AIRJAM_PROJECT_MCP_FILE);

  return {
    projectDir,
    server: createAirJamMcpServerDeclaration(),
    package: {
      dependencyPresent: Boolean(project.airJamPackages["@air-jam/mcp-server"]),
      scriptPresent: Boolean(project.scripts.mcp),
    },
    portableDeclaration: {
      configPath,
      present: await pathExists(configPath),
    },
    clients: {
      codex: await inspectCodexRegistration(projectDir),
      claudeDesktop: await inspectJsonRegistration(
        "claude-desktop",
        resolveClaudeDesktopConfigPath(),
      ),
    },
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
  const configPath = inspection.portableDeclaration.configPath;

  if (inspection.portableDeclaration.present && !force) {
    throw new Error(
      `MCP declaration already exists at ${configPath}. Re-run with force to overwrite it.`,
    );
  }

  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(
    configPath,
    renderMcpClientProfile({
      profile: "portable",
      projectDir: inspection.projectDir,
    }).content,
    "utf8",
  );

  return inspectMcpProjectSetup({ cwd });
};
