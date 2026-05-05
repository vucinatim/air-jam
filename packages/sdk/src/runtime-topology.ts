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

const RUNTIME_MODES = new Set<RuntimeMode>([
  "standalone-dev",
  "standalone-secure",
  "arcade-live",
  "arcade-built",
  "self-hosted-production",
  "hosted-release",
]);

const SURFACE_ROLES = new Set<SurfaceRole>([
  "host",
  "controller",
  "platform-host",
  "platform-controller",
]);

const PROXY_STRATEGIES = new Set<ProxyStrategy>([
  "none",
  "platform-proxy",
  "dev-proxy",
]);

const PROJECT_RUNTIME_MODES = new Set<
  NonNullable<ProjectRuntimeTopologyInput["runtimeMode"]>
>([
  "standalone-dev",
  "standalone-secure",
  "self-hosted-production",
  "hosted-release",
]);

const LOCAL_DEV_CONTROL_SURFACE_RUNTIME_MODES = new Set<RuntimeMode>([
  "standalone-dev",
  "standalone-secure",
  "arcade-live",
  "arcade-built",
]);

export const AIR_JAM_RUNTIME_TOPOLOGY_ENV_KEYS = [
  "VITE_AIR_JAM_RUNTIME_TOPOLOGY",
  "NEXT_PUBLIC_AIR_JAM_RUNTIME_TOPOLOGY",
  "AIR_JAM_RUNTIME_TOPOLOGY",
];

export const AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX = "aj_topology_";
export const AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY =
  "__AIR_JAM_RUNTIME_TOPOLOGY__";

const REQUIRED_QUERY_KEYS = [
  "runtime_mode",
  "surface_role",
  "app_origin",
  "backend_origin",
  "public_host",
  "asset_base_path",
  "secure_transport",
  "embedded",
  "proxy_strategy",
] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const assertString = (value: unknown, fieldName: string): string => {
  if (typeof value !== "string") {
    throw new Error(`Runtime topology field "${fieldName}" must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`Runtime topology field "${fieldName}" cannot be empty.`);
  }

  return normalized;
};

const assertBoolean = (value: unknown, fieldName: string): boolean => {
  if (typeof value !== "boolean") {
    throw new Error(`Runtime topology field "${fieldName}" must be a boolean.`);
  }

  return value;
};

const assertUrl = (value: unknown, fieldName: string): string => {
  const normalized = assertString(value, fieldName);
  const withScheme = normalized.includes("://")
    ? normalized
    : `http://${normalized}`;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error(
      `Runtime topology field "${fieldName}" must be a valid absolute URL.`,
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Runtime topology field "${fieldName}" must use http or https.`,
    );
  }

  parsed.pathname = "";
  parsed.search = "";
  parsed.hash = "";
  return parsed.origin;
};

const normalizeAssetBasePath = (value: unknown): string => {
  if (value == null) {
    return "/";
  }

  const normalized = assertString(value, "assetBasePath");
  if (normalized === "/") {
    return normalized;
  }

  const withLeadingSlash = normalized.startsWith("/")
    ? normalized
    : `/${normalized}`;

  return withLeadingSlash.endsWith("/") && withLeadingSlash.length > 1
    ? withLeadingSlash.slice(0, -1)
    : withLeadingSlash;
};

const toBooleanParam = (value: boolean): string => (value ? "true" : "false");

const fromBooleanParam = (value: string | null, fieldName: string): boolean => {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(
    `Runtime topology query field "${fieldName}" must be "true" or "false".`,
  );
};

const resolveDefaultSocketOrigin = ({
  proxyStrategy,
  appOrigin,
  backendOrigin,
}: {
  proxyStrategy: ProxyStrategy;
  appOrigin: string;
  backendOrigin: string;
}): string => {
  if (proxyStrategy === "none") {
    return backendOrigin;
  }

  return appOrigin;
};

const inferSecureTransport = ({
  runtimeMode,
  appOrigin,
  backendOrigin,
  socketOrigin,
  publicHost,
}: {
  runtimeMode: RuntimeMode;
  appOrigin: string;
  backendOrigin: string;
  socketOrigin: string;
  publicHost: string;
}): boolean => {
  if (runtimeMode === "standalone-secure") {
    return true;
  }

  return [appOrigin, backendOrigin, socketOrigin, publicHost].every((origin) =>
    origin.startsWith("https://"),
  );
};

export const resolveRuntimeTopology = (
  input: RuntimeTopologyInput,
): ResolvedAirJamRuntimeTopology => {
  if (!isObject(input)) {
    throw new Error("Runtime topology input must be an object.");
  }

  const runtimeMode = assertString(
    input.runtimeMode,
    "runtimeMode",
  ) as RuntimeMode;
  if (!RUNTIME_MODES.has(runtimeMode)) {
    throw new Error(
      `Unsupported runtime mode "${runtimeMode}". Use one of: ${Array.from(RUNTIME_MODES).join(", ")}.`,
    );
  }

  const surfaceRole = assertString(
    input.surfaceRole,
    "surfaceRole",
  ) as SurfaceRole;
  if (!SURFACE_ROLES.has(surfaceRole)) {
    throw new Error(
      `Unsupported surface role "${surfaceRole}". Use one of: ${Array.from(SURFACE_ROLES).join(", ")}.`,
    );
  }

  const appOrigin = assertUrl(input.appOrigin, "appOrigin");
  const backendOrigin = assertUrl(input.backendOrigin, "backendOrigin");

  const proxyStrategy =
    input.proxyStrategy == null
      ? "none"
      : (assertString(input.proxyStrategy, "proxyStrategy") as ProxyStrategy);
  if (!PROXY_STRATEGIES.has(proxyStrategy)) {
    throw new Error(
      `Unsupported proxy strategy "${proxyStrategy}". Use one of: ${Array.from(PROXY_STRATEGIES).join(", ")}.`,
    );
  }

  const socketOrigin =
    input.socketOrigin != null
      ? assertUrl(input.socketOrigin, "socketOrigin")
      : resolveDefaultSocketOrigin({ proxyStrategy, appOrigin, backendOrigin });
  const publicHost =
    input.publicHost != null
      ? assertUrl(input.publicHost, "publicHost")
      : appOrigin;
  const assetBasePath = normalizeAssetBasePath(input.assetBasePath);
  const embedded =
    input.embedded == null ? false : assertBoolean(input.embedded, "embedded");
  const embedParentOrigin =
    input.embedParentOrigin == null
      ? undefined
      : assertUrl(input.embedParentOrigin, "embedParentOrigin");

  if (embedded && !embedParentOrigin) {
    throw new Error(
      'Embedded runtimes must provide "embedParentOrigin" in their topology.',
    );
  }

  if (!embedded && embedParentOrigin) {
    throw new Error(
      'Non-embedded runtimes cannot provide "embedParentOrigin" in their topology.',
    );
  }

  const secureTransport =
    input.secureTransport == null
      ? inferSecureTransport({
          runtimeMode,
          appOrigin,
          backendOrigin,
          socketOrigin,
          publicHost,
        })
      : assertBoolean(input.secureTransport, "secureTransport");

  return {
    runtimeMode,
    surfaceRole,
    appOrigin,
    backendOrigin,
    socketOrigin,
    publicHost,
    assetBasePath,
    secureTransport,
    embedded,
    ...(embedParentOrigin ? { embedParentOrigin } : {}),
    proxyStrategy,
  };
};

export const resolveProjectRuntimeTopology = (
  input: ProjectRuntimeTopologyInput,
): ResolvedAirJamRuntimeTopology => {
  if (!isObject(input)) {
    throw new Error("Project runtime topology input must be an object.");
  }

  const requestedRuntimeMode =
    input.runtimeMode == null
      ? input.secureTransport
        ? "standalone-secure"
        : "standalone-dev"
      : (assertString(input.runtimeMode, "runtimeMode") as NonNullable<
          ProjectRuntimeTopologyInput["runtimeMode"]
        >);

  if (!PROJECT_RUNTIME_MODES.has(requestedRuntimeMode)) {
    throw new Error(
      `Unsupported project runtime mode "${requestedRuntimeMode}". Use one of: ${Array.from(PROJECT_RUNTIME_MODES).join(", ")}.`,
    );
  }

  const proxyStrategy =
    input.proxyStrategy ??
    (requestedRuntimeMode === "standalone-dev" ||
    requestedRuntimeMode === "standalone-secure"
      ? "dev-proxy"
      : "none");

  const appOrigin = assertUrl(input.appOrigin, "appOrigin");
  const backendOrigin =
    input.backendOrigin != null
      ? assertUrl(input.backendOrigin, "backendOrigin")
      : appOrigin;
  const publicHost =
    input.publicHost != null
      ? assertUrl(input.publicHost, "publicHost")
      : appOrigin;

  return resolveRuntimeTopology({
    runtimeMode: requestedRuntimeMode,
    surfaceRole: input.surfaceRole,
    appOrigin,
    backendOrigin,
    publicHost,
    assetBasePath: input.assetBasePath,
    secureTransport: input.secureTransport,
    embedded: input.embedded,
    embedParentOrigin: input.embedParentOrigin,
    proxyStrategy,
    ...(input.socketOrigin ? { socketOrigin: input.socketOrigin } : {}),
  });
};

export const isLocalDevControlSurfaceRuntimeMode = (
  runtimeMode: RuntimeMode,
): boolean =>
  LOCAL_DEV_CONTROL_SURFACE_RUNTIME_MODES.has(
    assertString(runtimeMode, "runtimeMode") as RuntimeMode,
  );

export const isLocalDevControlSurfaceTopology = ({
  runtimeMode,
}: Pick<ResolvedAirJamRuntimeTopology, "runtimeMode">): boolean =>
  isLocalDevControlSurfaceRuntimeMode(runtimeMode);

export const serializeRuntimeTopology = (
  topology: RuntimeTopologyInput | ResolvedAirJamRuntimeTopology,
): string => JSON.stringify(resolveRuntimeTopology(topology));

export const parseRuntimeTopology = (
  serialized: string,
): ResolvedAirJamRuntimeTopology => {
  const normalized = assertString(
    serialized,
    "serialized runtime topology",
  );

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new Error("Runtime topology must be valid JSON.");
  }

  return resolveRuntimeTopology(parsed as RuntimeTopologyInput);
};

export const readRuntimeTopologyFromEnv = (
  env: Record<string, string | undefined> = process.env,
): ResolvedAirJamRuntimeTopology | null => {
  for (const key of AIR_JAM_RUNTIME_TOPOLOGY_ENV_KEYS) {
    const candidate = env?.[key];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return parseRuntimeTopology(candidate);
    }
  }

  return null;
};

export const readRuntimeTopologyFromWindow = (
  target:
    | Record<string, unknown>
    | { [AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY]?: unknown }
    | undefined = (globalThis as typeof globalThis & {
    window?: { [AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY]?: unknown };
  }).window,
): ResolvedAirJamRuntimeTopology | null => {
  if (!target || typeof target !== "object") {
    return null;
  }

  const candidate = target[AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY];
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return parseRuntimeTopology(candidate);
  }

  if (isObject(candidate)) {
    return resolveRuntimeTopology(candidate as unknown as RuntimeTopologyInput);
  }

  return null;
};

export const runtimeTopologyToQueryParams = (
  topology: RuntimeTopologyInput | ResolvedAirJamRuntimeTopology,
): Record<string, string> => {
  const resolved = resolveRuntimeTopology(topology);

  return {
    [`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}runtime_mode`]:
      resolved.runtimeMode,
    [`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}surface_role`]:
      resolved.surfaceRole,
    [`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}app_origin`]:
      resolved.appOrigin,
    [`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}backend_origin`]:
      resolved.backendOrigin,
    [`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}socket_origin`]:
      resolved.socketOrigin,
    [`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}public_host`]:
      resolved.publicHost,
    [`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}asset_base_path`]:
      resolved.assetBasePath,
    [`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}secure_transport`]:
      toBooleanParam(resolved.secureTransport),
    [`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}embedded`]: toBooleanParam(
      resolved.embedded,
    ),
    [`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}proxy_strategy`]:
      resolved.proxyStrategy,
    ...(resolved.embedParentOrigin
      ? {
          [`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}embed_parent_origin`]:
            resolved.embedParentOrigin,
        }
      : {}),
  };
};

export const parseRuntimeTopologyFromSearchParams = (
  params: URLSearchParams,
): ResolvedAirJamRuntimeTopology | null => {
  if (!(params instanceof URLSearchParams)) {
    throw new Error(
      "Runtime topology search param reader expects URLSearchParams.",
    );
  }

  const hasAnyTopologyParam = REQUIRED_QUERY_KEYS.some((key) =>
    params.has(`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}${key}`),
  );
  if (!hasAnyTopologyParam) {
    return null;
  }

  const missing = REQUIRED_QUERY_KEYS.filter(
    (key) =>
      !params.has(`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}${key}`),
  );
  if (missing.length > 0) {
    throw new Error(
      `Runtime topology search params are incomplete. Missing: ${missing.join(", ")}.`,
    );
  }

  const embedParentOrigin = params.get(
    `${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}embed_parent_origin`,
  );

  return resolveRuntimeTopology({
    runtimeMode: params.get(
      `${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}runtime_mode`,
    ) as RuntimeMode,
    surfaceRole: params.get(
      `${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}surface_role`,
    ) as SurfaceRole,
    appOrigin: params.get(
      `${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}app_origin`,
    ) as string,
    backendOrigin: params.get(
      `${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}backend_origin`,
    ) as string,
    socketOrigin: params.get(
      `${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}socket_origin`,
    ) as string,
    publicHost: params.get(
      `${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}public_host`,
    ) as string,
    assetBasePath: params.get(
      `${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}asset_base_path`,
    ) as string,
    secureTransport: fromBooleanParam(
      params.get(
        `${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}secure_transport`,
      ),
      "secure_transport",
    ),
    embedded: fromBooleanParam(
      params.get(`${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}embedded`),
      "embedded",
    ),
    proxyStrategy: params.get(
      `${AIR_JAM_RUNTIME_TOPOLOGY_QUERY_PARAM_PREFIX}proxy_strategy`,
    ) as ProxyStrategy,
    ...(embedParentOrigin ? { embedParentOrigin } : {}),
  });
};
