import type {
  ResolvedAirJamRuntimeTopology,
  SurfaceRole,
} from "@air-jam/runtime-topology";

export declare const buildStandaloneGameTopology: (input: {
  surfaceRole: Extract<SurfaceRole, "host" | "controller">;
  publicHost: string;
  secureTransport?: boolean;
  backendOrigin?: string;
}) => ResolvedAirJamRuntimeTopology;

export declare const buildPlatformShellTopology: (input: {
  runtimeMode: Extract<
    ResolvedAirJamRuntimeTopology["runtimeMode"],
    "arcade-live" | "arcade-built"
  >;
  surfaceRole: Extract<SurfaceRole, "platform-host" | "platform-controller">;
  appOrigin: string;
  publicHost: string;
  backendOrigin?: string;
  secureTransport?: boolean;
}) => ResolvedAirJamRuntimeTopology;

export declare const buildEmbeddedGameTopology: (input: {
  runtimeMode: Extract<
    ResolvedAirJamRuntimeTopology["runtimeMode"],
    "arcade-live" | "arcade-built"
  >;
  surfaceRole: Extract<SurfaceRole, "host" | "controller">;
  runtimeUrl: string;
  publicHost: string;
  embedParentOrigin: string;
  backendOrigin?: string;
  secureTransport?: boolean;
}) => ResolvedAirJamRuntimeTopology;

export declare const serializeResolvedTopology: (
  topology: ResolvedAirJamRuntimeTopology,
) => string;
