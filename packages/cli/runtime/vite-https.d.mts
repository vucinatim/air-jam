export const DEFAULT_AIR_JAM_DEV_BACKEND_URL: string;

export function getAirJamHttpsServerOptions(
  env?: NodeJS.ProcessEnv,
): { cert: Buffer; key: Buffer } | undefined;

export function getAirJamDevBackendUrl(env?: NodeJS.ProcessEnv): string;

export function getAirJamDevProxyOptions(
  env?: NodeJS.ProcessEnv,
): Record<string, { target: string; ws?: boolean; changeOrigin: boolean }>;
