import {
  resolveRuntimeTopology,
  type ResolvedAirJamRuntimeTopology,
  type SurfaceRole,
} from "@air-jam/runtime-topology";

const resolveAssetBasePath = (runtimeUrl: string): string => {
  const parsed = new URL(runtimeUrl);
  if (parsed.pathname.startsWith("/airjam-local-builds/")) {
    const [, localBuilds, gameId] = parsed.pathname.split("/");
    return `/${localBuilds}/${gameId}`;
  }

  return "/";
};

export const buildEmbeddedRuntimeTopology = ({
  runtimeMode,
  surfaceRole,
  runtimeUrl,
  parentTopology,
}: {
  runtimeMode: Extract<
    ResolvedAirJamRuntimeTopology["runtimeMode"],
    "arcade-live" | "arcade-built"
  >;
  surfaceRole: Extract<SurfaceRole, "host" | "controller">;
  runtimeUrl: string;
  parentTopology: ResolvedAirJamRuntimeTopology;
}): ResolvedAirJamRuntimeTopology =>
  resolveRuntimeTopology({
    runtimeMode,
    surfaceRole,
    appOrigin: new URL(runtimeUrl).origin,
    backendOrigin: parentTopology.backendOrigin,
    publicHost: parentTopology.publicHost,
    assetBasePath: resolveAssetBasePath(runtimeUrl),
    secureTransport: parentTopology.secureTransport,
    embedded: true,
    embedParentOrigin: parentTopology.appOrigin,
    proxyStrategy: "none",
  });
