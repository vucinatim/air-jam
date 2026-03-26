import { DEFAULT_MAX_PLAYERS } from "../constants";
import {
  createAirJamDiagnosticError,
  emitAirJamDiagnostic,
} from "../diagnostics";

export interface AirJamConfig {
  serverUrl?: string;
  appId?: string;
  hostGrantEndpoint?: string;
  maxPlayers: number;
  publicHost?: string;
}

export interface ResolveAirJamConfigInput {
  serverUrl?: string;
  appId?: string;
  hostGrantEndpoint?: string;
  maxPlayers?: number;
  publicHost?: string;
  resolveEnv?: boolean;
}

interface ImportMetaEnv {
  VITE_AIR_JAM_SERVER_URL?: string;
  VITE_AIR_JAM_APP_ID?: string;
  VITE_AIR_JAM_HOST_GRANT_ENDPOINT?: string;
  VITE_AIR_JAM_PUBLIC_HOST?: string;
}

interface ProcessLike {
  env?: Record<string, string | undefined>;
}

const getNodeEnv = (): Record<string, string | undefined> | undefined => {
  const candidate = (globalThis as { process?: ProcessLike }).process;
  return candidate?.env;
};

const getViteEnv = (): ImportMetaEnv | undefined => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = import.meta as any;
    if (meta && typeof meta.env === "object") {
      return meta.env as ImportMetaEnv;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const getNodeEnvMode = (): string | undefined => {
  return getNodeEnv()?.NODE_ENV;
};

const getEnvServerUrl = (): string | undefined => {
  const viteEnv = getViteEnv();
  if (viteEnv?.VITE_AIR_JAM_SERVER_URL) {
    return viteEnv.VITE_AIR_JAM_SERVER_URL;
  }

  const nodeEnv = getNodeEnv();
  if (nodeEnv) {
    const nextUrl = nodeEnv.NEXT_PUBLIC_AIR_JAM_SERVER_URL;
    if (nextUrl) {
      return nextUrl;
    }
  }

  return undefined;
};

const getEnvAppId = (): string | undefined => {
  const viteEnv = getViteEnv();
  if (viteEnv?.VITE_AIR_JAM_APP_ID) {
    return viteEnv.VITE_AIR_JAM_APP_ID;
  }

  const nodeEnv = getNodeEnv();
  if (nodeEnv) {
    const nextAppId = nodeEnv.NEXT_PUBLIC_AIR_JAM_APP_ID;
    if (nextAppId) {
      return nextAppId;
    }
  }

  return undefined;
};

const getEnvPublicHost = (): string | undefined => {
  const viteEnv = getViteEnv();
  if (viteEnv?.VITE_AIR_JAM_PUBLIC_HOST) {
    return viteEnv.VITE_AIR_JAM_PUBLIC_HOST;
  }

  const nodeEnv = getNodeEnv();
  if (nodeEnv) {
    const nextHost = nodeEnv.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST;
    if (nextHost) {
      return nextHost;
    }
  }

  return undefined;
};

const getEnvHostGrantEndpoint = (): string | undefined => {
  const viteEnv = getViteEnv();
  if (viteEnv?.VITE_AIR_JAM_HOST_GRANT_ENDPOINT) {
    return viteEnv.VITE_AIR_JAM_HOST_GRANT_ENDPOINT;
  }

  const nodeEnv = getNodeEnv();
  if (nodeEnv) {
    const nextEndpoint = nodeEnv.NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT;
    if (nextEndpoint) {
      return nextEndpoint;
    }
  }

  return undefined;
};

export const resolveAirJamConfig = ({
  serverUrl,
  appId,
  hostGrantEndpoint,
  maxPlayers = DEFAULT_MAX_PLAYERS,
  publicHost,
  resolveEnv = true,
}: ResolveAirJamConfigInput): AirJamConfig => {
  if (!resolveEnv) {
    if (!serverUrl) {
      throw createAirJamDiagnosticError(
        "AJ_CONFIG_MISSING_SERVER_URL",
        "Missing server URL. Provide `serverUrl` when `resolveEnv` is disabled.",
      );
    }
    return {
      serverUrl,
      appId,
      hostGrantEndpoint,
      maxPlayers,
      publicHost,
    };
  }

  const resolvedAppId = appId ?? getEnvAppId();

  if (getNodeEnvMode() === "production" && !resolvedAppId) {
    emitAirJamDiagnostic({
      code: "AJ_CONFIG_MISSING_APP_ID",
      severity: "error",
      message:
        "Missing app ID in production. Set VITE_AIR_JAM_APP_ID or NEXT_PUBLIC_AIR_JAM_APP_ID, or pass `appId` to the session provider.",
    });
  }

  return {
    serverUrl: serverUrl ?? getEnvServerUrl(),
    appId: resolvedAppId,
    hostGrantEndpoint: hostGrantEndpoint ?? getEnvHostGrantEndpoint(),
    maxPlayers,
    publicHost: publicHost ?? getEnvPublicHost(),
  };
};
