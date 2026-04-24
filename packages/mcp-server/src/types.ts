export type AirJamProjectLocalMcpConfig = {
  mcpServers: {
    airjam: {
      command: string;
      args: string[];
    };
  };
};

export type InspectMcpProjectSetupResult = {
  projectDir: string;
  configPath: string;
  hasConfigFile: boolean;
  hasMcpScript: boolean;
  hasMcpDependency: boolean;
  recommendedConfig: AirJamProjectLocalMcpConfig;
};
