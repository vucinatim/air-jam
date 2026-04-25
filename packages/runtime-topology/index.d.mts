export type RuntimeMode =
  | "standalone-dev"
  | "standalone-secure"
  | "arcade-live"
  | "arcade-built"
  | "self-hosted-production"
  | "hosted-release";

export type SurfaceRole =
  | "host"
  | "controller"
  | "platform-host"
  | "platform-controller";

export type ProxyStrategy = "none" | "platform-proxy" | "dev-proxy";

export interface RuntimeTopologyInput {
  runtimeMode: RuntimeMode;
  surfaceRole: SurfaceRole;
  appOrigin: string;
  backendOrigin: string;
  socketOrigin?: string;
  publicHost?: string;
  assetBasePath?: string;
  secureTransport?: boolean;
  embedded?: boolean;
  embedParentOrigin?: string;
  proxyStrategy?: ProxyStrategy;
}

export interface ProjectRuntimeTopologyInput {
  runtimeMode?:
    | "standalone-dev"
    | "standalone-secure"
    | "self-hosted-production"
    | "hosted-release";
  surfaceRole: Extract<SurfaceRole, "host" | "controller">;
  appOrigin: string;
  backendOrigin?: string;
  socketOrigin?: string;
  publicHost?: string;
  assetBasePath?: string;
  secureTransport?: boolean;
  embedded?: boolean;
  embedParentOrigin?: string;
  proxyStrategy?: Extract<ProxyStrategy, "none" | "dev-proxy">;
}

export interface ResolvedAirJamRuntimeTopology {
  runtimeMode: RuntimeMode;
  surfaceRole: SurfaceRole;
  appOrigin: string;
  backendOrigin: string;
  socketOrigin: string;
  publicHost: string;
  assetBasePath: string;
  secureTransport: boolean;
  embedded: boolean;
  embedParentOrigin?: string;
  proxyStrategy: ProxyStrategy;
}

export declare const AIR_JAM_RUNTIME_TOPOLOGY_ENV_KEYS: string[];
export declare const AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX: string;
export declare const AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY: string;

export declare const resolveRuntimeTopology: (
  input: RuntimeTopologyInput,
) => ResolvedAirJamRuntimeTopology;

export declare const resolveProjectRuntimeTopology: (
  input: ProjectRuntimeTopologyInput,
) => ResolvedAirJamRuntimeTopology;

export declare const isLocalDevControlSurfaceRuntimeMode: (
  runtimeMode: RuntimeMode,
) => boolean;

export declare const isLocalDevControlSurfaceTopology: (
  topology: Pick<ResolvedAirJamRuntimeTopology, "runtimeMode">,
) => boolean;

export declare const serializeRuntimeTopology: (
  topology: RuntimeTopologyInput | ResolvedAirJamRuntimeTopology,
) => string;

export declare const parseRuntimeTopology: (
  serialized: string,
) => ResolvedAirJamRuntimeTopology;

export declare const readRuntimeTopologyFromEnv: (
  env?: Record<string, string | undefined>,
) => ResolvedAirJamRuntimeTopology | null;

export declare const readRuntimeTopologyFromWindow: (
  target?: object | undefined,
) => ResolvedAirJamRuntimeTopology | null;

export declare const runtimeTopologyToQueryParams: (
  topology: RuntimeTopologyInput | ResolvedAirJamRuntimeTopology,
) => Record<string, string>;

export declare const parseRuntimeTopologyFromSearchParams: (
  params: URLSearchParams,
) => ResolvedAirJamRuntimeTopology | null;
