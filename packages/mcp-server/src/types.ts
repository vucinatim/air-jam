export type AirJamMcpServerDeclaration = {
  name: "airjam";
  transport: "stdio";
  command: "pnpm";
  args: ["exec", "airjam-mcp"];
};

export type AirJamProjectLocalMcpConfig = {
  mcpServers: {
    airjam: {
      command: string;
      args: string[];
    };
  };
};

export type AirJamMcpClientProfile = "portable" | "codex" | "claude-desktop";

export type AirJamMcpClientProfileRender = {
  profile: AirJamMcpClientProfile;
  format: "json" | "toml";
  scope: "project" | "client-global";
  configPath: string | null;
  content: string;
  installCommand: string | null;
};

export type AirJamMcpRegistrationInspection = {
  profile: AirJamMcpClientProfile;
  configPath: string | null;
  configPresent: boolean | null;
  registered: boolean | null;
};

export type InspectMcpProjectSetupResult = {
  projectDir: string;
  server: AirJamMcpServerDeclaration;
  package: {
    dependencyPresent: boolean;
    scriptPresent: boolean;
  };
  portableDeclaration: {
    configPath: string;
    present: boolean;
  };
  clients: {
    codex: AirJamMcpRegistrationInspection;
    claudeDesktop: AirJamMcpRegistrationInspection;
  };
  recommendedConfig: AirJamProjectLocalMcpConfig;
};
