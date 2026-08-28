export declare const runGameDevCli: (options?: {
  cwd?: string;
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  serverPort?: number;
}) => Promise<void>;
