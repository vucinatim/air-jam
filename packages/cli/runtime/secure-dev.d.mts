export const SECURE_MODE_LOCAL: "local";
export const SECURE_MODE_TUNNEL: "tunnel";
export const DEFAULT_GAME_PORT: 5173;
export const DEFAULT_PLATFORM_PORT: 3000;

type SecureMode = typeof SECURE_MODE_LOCAL | typeof SECURE_MODE_TUNNEL;

type SecureDevState = {
  version: number;
  mode: SecureMode;
  generatedAt: string;
  lanIp: string | null;
  certFile: string;
  keyFile: string;
  hosts: string[];
  publicHost: string;
  tunnelHost: string | null;
  tunnelName: string | null;
  loopbackHost: string;
  platformHost: string;
};

export declare const loadSecureDevState: (options: {
  cwd: string;
  mode: SecureMode;
  env?: NodeJS.ProcessEnv;
  gamePort?: number;
}) => SecureDevState;

export declare const buildSecureGameEnv: (options: {
  secureState: Pick<
    SecureDevState,
    "mode" | "publicHost" | "certFile" | "keyFile"
  >;
  webOnly?: boolean;
  env?: NodeJS.ProcessEnv;
  backendOrigin?: string;
}) => NodeJS.ProcessEnv;

export function resolveRequestedSecureMode(options?: {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  defaultMode?: "local" | "tunnel";
}): "local" | "tunnel";

export declare const runSecureInitCli: (options?: {
  cwd?: string;
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  nextStepMessage?: string;
}) => Promise<void>;
