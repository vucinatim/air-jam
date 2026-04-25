import {
  resolveProjectRuntimeTopology,
  resolveRuntimeTopology,
  serializeRuntimeTopology,
} from "@air-jam/runtime-topology";
import { DEFAULT_AIR_JAM_DEV_BACKEND_URL } from "./vite-https.mjs";

const normalizeAssetBasePath = (runtimeUrl) => {
  const parsed = new URL(runtimeUrl);
  if (parsed.pathname.startsWith("/airjam-local-builds/")) {
    const [, localBuilds, gameId] = parsed.pathname.split("/");
    return `/${localBuilds}/${gameId}`;
  }

  return "/";
};

export const buildStandaloneGameTopology = ({
  surfaceRole,
  publicHost,
  secureTransport = false,
  backendOrigin = DEFAULT_AIR_JAM_DEV_BACKEND_URL,
}) =>
  resolveProjectRuntimeTopology({
    runtimeMode: secureTransport ? "standalone-secure" : "standalone-dev",
    surfaceRole,
    appOrigin: publicHost,
    backendOrigin,
    publicHost,
    secureTransport,
  });

export const buildPlatformShellTopology = ({
  runtimeMode,
  surfaceRole,
  appOrigin,
  publicHost,
  backendOrigin = DEFAULT_AIR_JAM_DEV_BACKEND_URL,
  secureTransport = false,
}) =>
  resolveRuntimeTopology({
    runtimeMode,
    surfaceRole,
    appOrigin,
    backendOrigin,
    publicHost,
    proxyStrategy: "platform-proxy",
    secureTransport,
  });

export const buildEmbeddedGameTopology = ({
  runtimeMode,
  surfaceRole,
  runtimeUrl,
  publicHost,
  embedParentOrigin,
  backendOrigin = DEFAULT_AIR_JAM_DEV_BACKEND_URL,
  secureTransport = false,
}) =>
  resolveRuntimeTopology({
    runtimeMode,
    surfaceRole,
    appOrigin: new URL(runtimeUrl).origin,
    backendOrigin,
    publicHost,
    assetBasePath: normalizeAssetBasePath(runtimeUrl),
    secureTransport,
    embedded: true,
    embedParentOrigin,
    proxyStrategy: "none",
  });

export const serializeResolvedTopology = (topology) =>
  serializeRuntimeTopology(topology);
