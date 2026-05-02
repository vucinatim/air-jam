import {
  isLocalDevControlSurfaceRuntimeMode,
  type ResolvedAirJamRuntimeTopology,
} from "@air-jam/runtime-topology";
import { parseOptionalArcadeSurfaceFromSearchParams } from "../runtime/arcade-runtime-url";

export type HostPreviewControllerWorkspaceEnabled = boolean | "auto";

export interface ResolveHostPreviewControllerWorkspaceEnabledOptions {
  enabled?: HostPreviewControllerWorkspaceEnabled;
  topology?: Pick<ResolvedAirJamRuntimeTopology, "runtimeMode">;
  isDevelopmentRuntime?: boolean;
  searchParams?: URLSearchParams | string;
}

interface ImportMetaEnv {
  DEV?: boolean;
}

interface ProcessLike {
  env?: Record<string, string | undefined>;
}

const readDevelopmentRuntime = (): boolean => {
  try {
    const meta = import.meta as ImportMeta & { env?: ImportMetaEnv };
    const env = meta.env;
    if (typeof env?.DEV === "boolean") {
      return env.DEV;
    }
  } catch {
    // Fall through to NODE_ENV for non-Vite runtimes.
  }

  const processLike = (globalThis as { process?: ProcessLike }).process;
  return processLike?.env?.NODE_ENV !== "production";
};

const readWindowSearchParams = (): URLSearchParams => {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.search);
};

const toSearchParams = (
  value: URLSearchParams | string | undefined,
): URLSearchParams => {
  if (typeof value === "string") {
    return new URLSearchParams(value);
  }
  return value ?? readWindowSearchParams();
};

export const isEmbeddedArcadeRuntimeSearchParams = (
  searchParams: URLSearchParams | string | undefined,
): boolean =>
  parseOptionalArcadeSurfaceFromSearchParams(toSearchParams(searchParams)) !=
  null;

export const resolveHostPreviewControllerWorkspaceEnabled = ({
  enabled = "auto",
  topology,
  isDevelopmentRuntime = readDevelopmentRuntime(),
  searchParams,
}: ResolveHostPreviewControllerWorkspaceEnabledOptions = {}): boolean => {
  if (typeof enabled === "boolean") {
    return enabled;
  }

  const localDevControlSurfacesEnabled =
    topology != null
      ? isLocalDevControlSurfaceRuntimeMode(topology.runtimeMode)
      : isDevelopmentRuntime;

  return (
    localDevControlSurfacesEnabled &&
    !isEmbeddedArcadeRuntimeSearchParams(searchParams)
  );
};
