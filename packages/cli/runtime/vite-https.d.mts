import type { ServerOptions } from "node:https";
import type { ProxyOptions } from "vite";

export const DEFAULT_AIR_JAM_DEV_BACKEND_URL: string;

export function getAirJamHttpsServerOptions(
  env?: NodeJS.ProcessEnv,
): ServerOptions | undefined;

export function getAirJamDevBackendUrl(env?: NodeJS.ProcessEnv): string;

export function getAirJamDevProxyOptions(
  env?: NodeJS.ProcessEnv,
): Record<string, ProxyOptions>;
