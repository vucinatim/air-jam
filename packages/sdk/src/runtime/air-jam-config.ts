import { DEFAULT_MAX_PLAYERS } from "../constants";
import {
  createAirJamDiagnosticError,
  emitAirJamDiagnostic,
} from "../diagnostics";

export interface AirJamConfig {
  serverUrl?: string;
  apiKey?: string;
  maxPlayers: number;
  publicHost?: string;
}

export interface ResolveAirJamConfigInput {
  serverUrl?: string;
  apiKey?: string;
  maxPlayers?: number;
  publicHost?: string;
  resolveEnv?: boolean;
}

interface ImportMetaEnv {
  VITE_AIR_JAM_SERVER_URL?: string;
  VITE_AIR_JAM_PUBLIC_KEY?: string;
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

const getEnvApiKey = (): string | undefined => {
  const viteEnv = getViteEnv();
  if (viteEnv?.VITE_AIR_JAM_PUBLIC_KEY) {
    return viteEnv.VITE_AIR_JAM_PUBLIC_KEY;
  }

  const nodeEnv = getNodeEnv();
  if (nodeEnv) {
    const nextPublicKey = nodeEnv.NEXT_PUBLIC_AIR_JAM_PUBLIC_KEY;
    if (nextPublicKey) {
      return nextPublicKey;
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

export const resolveAirJamConfig = ({
  serverUrl,
  apiKey,
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
      apiKey,
      maxPlayers,
      publicHost,
    };
  }

  const resolvedApiKey = apiKey ?? getEnvApiKey();

  if (getNodeEnvMode() === "production" && !resolvedApiKey) {
    emitAirJamDiagnostic({
      code: "AJ_CONFIG_MISSING_API_KEY",
      severity: "error",
      message:
        "Missing API key in production. Set VITE_AIR_JAM_PUBLIC_KEY or NEXT_PUBLIC_AIR_JAM_PUBLIC_KEY, or pass `apiKey` to the session provider.",
    });
  }

  return {
    serverUrl: serverUrl ?? getEnvServerUrl(),
    apiKey: resolvedApiKey,
    maxPlayers,
    publicHost: publicHost ?? getEnvPublicHost(),
  };
};
