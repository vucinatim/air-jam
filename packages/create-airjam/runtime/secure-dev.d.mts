export const SECURE_MODE_LOCAL: "local";
export const SECURE_MODE_TUNNEL: "tunnel";
export const DEFAULT_GAME_PORT: 5173;
export const DEFAULT_PLATFORM_PORT: 3000;

export function resolveRequestedSecureMode(options?: {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  defaultMode?: "local" | "tunnel";
}): "local" | "tunnel";

export declare const runSecureInitCli: (options?: {
  cwd?: string;
  argv?: string[];
  env?: NodeJS.ProcessEnv;
}) => Promise<void>;
