import {
  createAirJamDiagnosticError,
  emitAirJamDiagnostic,
} from "../diagnostics";
import type { HostSessionKind } from "../protocol/host";
import {
  isLocalDevControlSurfaceTopology,
  parseRuntimeTopologyFromSearchParams,
  readRuntimeTopologyFromEnv,
  readRuntimeTopologyFromWindow,
  resolveProjectRuntimeTopology,
  resolveRuntimeTopology,
  type ResolvedAirJamRuntimeTopology,
  type RuntimeTopologyInput,
  type SurfaceRole,
} from "../runtime-topology";

import { createAirJamConfig, type AirJamConfig } from "../core/config";

export type { AirJamConfig };

export interface ResolveAirJamConfigInput {
  topology?: RuntimeTopologyInput | ResolvedAirJamRuntimeTopology;
  surfaceRole?: SurfaceRole;
  appId?: string;
  hostGrantEndpoint?: string;
  maxPlayers?: number;
  hostSessionKind?: HostSessionKind;
  resolveEnv?: boolean;
}

interface ImportMetaEnv {
  DEV?: boolean;
  VITE_AIR_JAM_RUNTIME_TOPOLOGY?: string;
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
    const meta = import.meta as ImportMeta & { env?: ImportMetaEnv };
    if (meta && typeof meta.env === "object") {
      return meta.env;
    }
  } catch {
    return undefined;
  }

  return undefined;
};

const getNodeEnvMode = (): string | undefined => {
  return getNodeEnv()?.NODE_ENV;
};

const isDevelopmentRuntime = (): boolean => {
  const viteEnv = getViteEnv();
  if (typeof viteEnv?.DEV === "boolean") {
    return viteEnv.DEV;
  }

  return getNodeEnvMode() !== "production";
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

const readRuntimeTopologyFromViteEnv =
  (): ResolvedAirJamRuntimeTopology | null => {
    const viteEnv = getViteEnv();
    if (!viteEnv?.VITE_AIR_JAM_RUNTIME_TOPOLOGY) {
      return null;
    }

    return readRuntimeTopologyFromEnv({
      VITE_AIR_JAM_RUNTIME_TOPOLOGY: viteEnv.VITE_AIR_JAM_RUNTIME_TOPOLOGY,
    });
  };

const readRuntimeTopologyFromWindowSearchParams =
  (): ResolvedAirJamRuntimeTopology | null => {
    if (typeof window === "undefined") {
      return null;
    }

    return parseRuntimeTopologyFromSearchParams(
      new URLSearchParams(window.location.search),
    );
  };

export const resolveEnvironmentRuntimeTopology = (
  defaults: ResolvedAirJamRuntimeTopology | null,
  development: boolean,
): ResolvedAirJamRuntimeTopology | null => {
  const bootstrap = readRuntimeTopologyFromWindow();
  if (bootstrap) return bootstrap;
  if (
    development &&
    (!defaults || isLocalDevControlSurfaceTopology(defaults))
  ) {
    const surface = readRuntimeTopologyFromWindowSearchParams();
    if (surface && !isLocalDevControlSurfaceTopology(surface))
      throw new Error(
        "Development surface topology must use a local development mode.",
      );
    if (surface) return surface;
  }
  return defaults;
};

const applySurfaceRoleOverride = (
  topology: ResolvedAirJamRuntimeTopology | null,
  surfaceRole?: SurfaceRole,
): ResolvedAirJamRuntimeTopology | null => {
  if (!topology || !surfaceRole || topology.surfaceRole === surfaceRole) {
    return topology;
  }

  return resolveRuntimeTopology({
    ...topology,
    surfaceRole,
  });
};

const resolveProjectTopologyFromEnv = (
  surfaceRole?: SurfaceRole,
): ResolvedAirJamRuntimeTopology | null => {
  const effectiveSurfaceRole = surfaceRole ?? "host";
  if (
    effectiveSurfaceRole !== "host" &&
    effectiveSurfaceRole !== "controller"
  ) {
    return null;
  }

  const explicitPublicHost = getEnvPublicHost();
  const appOrigin =
    explicitPublicHost ??
    (typeof window !== "undefined" ? window.location.origin : undefined);
  if (!appOrigin) {
    return null;
  }

  const secureTransport = appOrigin.startsWith("https://");
  const runtimeMode = isDevelopmentRuntime()
    ? secureTransport
      ? "standalone-secure"
      : "standalone-dev"
    : "self-hosted-production";

  return resolveProjectRuntimeTopology({
    runtimeMode,
    surfaceRole: effectiveSurfaceRole,
    appOrigin,
    backendOrigin: getEnvServerUrl() ?? appOrigin,
    publicHost: explicitPublicHost ?? appOrigin,
    secureTransport,
  });
};

export const resolveAirJamConfig = ({
  topology,
  surfaceRole,
  appId,
  hostGrantEndpoint,
  maxPlayers,
  hostSessionKind,
  resolveEnv = true,
}: ResolveAirJamConfigInput): AirJamConfig => {
  const resolvedTopology = topology
    ? applySurfaceRoleOverride(resolveRuntimeTopology(topology), surfaceRole)
    : resolveEnv
      ? applySurfaceRoleOverride(
          resolveEnvironmentRuntimeTopology(
            readRuntimeTopologyFromViteEnv() ??
              readRuntimeTopologyFromEnv(getNodeEnv()) ??
              resolveProjectTopologyFromEnv(surfaceRole),
            isDevelopmentRuntime(),
          ),
          surfaceRole,
        )
      : null;

  if (!resolvedTopology) {
    throw createAirJamDiagnosticError(
      "AJ_CONFIG_MISSING_RUNTIME_TOPOLOGY",
      "Missing runtime topology. Provide `topology` directly, or enable env resolution with a supported project/runtime mode.",
    );
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

  return createAirJamConfig({
    topology: resolvedTopology,
    appId: resolvedAppId,
    hostGrantEndpoint: hostGrantEndpoint ?? getEnvHostGrantEndpoint(),
    maxPlayers,
    hostSessionKind,
  });
};
