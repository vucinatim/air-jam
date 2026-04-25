import type { ResolvedAirJamRuntimeTopology } from "@air-jam/runtime-topology";
import { resolveProjectRuntimeTopology } from "@air-jam/runtime-topology";
import type { JSX, ReactNode } from "react";
import type { z } from "zod";
import type { AirJamGameAgentContract } from "../agent/game-agent-contract";
import type { AirJamGameCapabilityManifest } from "../capabilities/manifest";
import { CONTROLLER_PATH } from "../constants";
import { type AirJamProviderProps } from "../context/session-providers";
import type { AirJamControllerOptions } from "../hooks/use-air-jam-controller";
import type { AirJamHostOptions } from "../hooks/use-air-jam-host";
import { type ResolveAirJamConfigInput } from "./air-jam-config";
import {
  AirJamErrorBoundary,
  type AirJamErrorBoundaryProps,
  type AirJamErrorFallbackRenderer,
} from "./air-jam-error-boundary";
import { AirJamControllerRuntime, AirJamHostRuntime } from "./session-runtimes";

type HostSessionProps<TSchema extends z.ZodSchema> = Omit<
  AirJamProviderProps<TSchema>,
  "children"
>;

type ControllerSessionProps = Omit<AirJamProviderProps, "children" | "input">;

export interface AirJamGameRuntimeConfig {
  /**
   * Controller route path relative to the game origin.
   * Defaults to "/controller".
   */
  controllerPath?: string;
  /**
   * Experimental game capability metadata for future machine-facing control,
   * inspection, and evaluation workflows.
   */
  capabilities?: AirJamGameCapabilityManifest;
  /**
   * Optional machine-facing contracts published by the game.
   *
   * These are consumed by Air Jam devtools and MCP adapters through
   * `airjam.config.ts` instead of inferred filesystem conventions.
   */
  machine?: {
    agent?: AirJamGameAgentContract;
    /**
     * Explicit module specifier for the game's visual scenario pack.
     *
     * This stays as a module reference instead of an imported object because
     * visual scenario packs are Node-only authoring artifacts that should not
     * be pulled into the browser bundle through `airjam.config.ts`.
     */
    visualScenariosModule?: string;
  };
}

export interface AirJamRuntimeErrorBoundaryOptions {
  renderFallback?: AirJamErrorFallbackRenderer;
  onError?: AirJamErrorBoundaryProps["onError"];
}

export interface AirJamAppErrorBoundaryOptions {
  host?: AirJamRuntimeErrorBoundaryOptions;
  controller?: AirJamRuntimeErrorBoundaryOptions;
}

export interface CreateAirJamAppOptions<
  TSchema extends z.ZodSchema = z.ZodSchema,
> {
  runtime?: ResolveAirJamConfigInput;
  game?: AirJamGameRuntimeConfig;
  input?: AirJamProviderProps<TSchema>["input"];
  errorBoundary?: AirJamAppErrorBoundaryOptions;
}

export interface AirJamApp<TSchema extends z.ZodSchema = z.ZodSchema> {
  Host: (props: AirJamHostOptions & { children: ReactNode }) => JSX.Element;
  Controller: (
    props: AirJamControllerOptions & { children: ReactNode },
  ) => JSX.Element;
  paths: {
    controller: string;
  };
  session: {
    host: HostSessionProps<TSchema>;
    controller: ControllerSessionProps;
  };
  runtime: ResolveAirJamConfigInput;
  game: {
    controllerPath: string;
    capabilities?: AirJamGameCapabilityManifest;
    machine?: AirJamGameRuntimeConfig["machine"];
  };
}

const resolveControllerPath = (controllerPath?: string): string => {
  const normalized = controllerPath ?? CONTROLLER_PATH;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
};

export interface ViteEnvLike {
  DEV?: boolean;
  VITE_AIR_JAM_RUNTIME_TOPOLOGY?: string;
  VITE_AIR_JAM_SERVER_URL?: string;
  VITE_AIR_JAM_APP_ID?: string;
  VITE_AIR_JAM_HOST_GRANT_ENDPOINT?: string;
  VITE_AIR_JAM_PUBLIC_HOST?: string;
}

type ViteEnvSource = Record<string, unknown> | undefined;

const toViteEnvLike = (source?: ViteEnvSource): ViteEnvLike | undefined => {
  if (!source) {
    return undefined;
  }

  const readString = (key: keyof ViteEnvLike): string | undefined => {
    const value = source[key];
    return typeof value === "string" ? value : undefined;
  };

  return {
    DEV: source.DEV === true,
    VITE_AIR_JAM_RUNTIME_TOPOLOGY: readString("VITE_AIR_JAM_RUNTIME_TOPOLOGY"),
    VITE_AIR_JAM_SERVER_URL: readString("VITE_AIR_JAM_SERVER_URL"),
    VITE_AIR_JAM_APP_ID: readString("VITE_AIR_JAM_APP_ID"),
    VITE_AIR_JAM_HOST_GRANT_ENDPOINT: readString(
      "VITE_AIR_JAM_HOST_GRANT_ENDPOINT",
    ),
    VITE_AIR_JAM_PUBLIC_HOST: readString("VITE_AIR_JAM_PUBLIC_HOST"),
  };
};

const readViteEnv = (): ViteEnvLike | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidate = import.meta as any;
    if (candidate && typeof candidate.env === "object") {
      return candidate.env as ViteEnvLike;
    }
  } catch {
    return null;
  }
  return null;
};

export const env = {
  auto: (): ResolveAirJamConfigInput => ({
    resolveEnv: true,
  }),
  vite: (viteEnvInput?: ViteEnvSource): ResolveAirJamConfigInput => {
    const viteEnv = toViteEnvLike(viteEnvInput) ?? readViteEnv();
    const explicitTopology = viteEnv?.VITE_AIR_JAM_RUNTIME_TOPOLOGY
      ? (JSON.parse(
          viteEnv.VITE_AIR_JAM_RUNTIME_TOPOLOGY,
        ) as ResolvedAirJamRuntimeTopology)
      : null;
    const projectTopology =
      !explicitTopology && viteEnv?.VITE_AIR_JAM_PUBLIC_HOST
        ? resolveProjectRuntimeTopology({
            runtimeMode: viteEnv.DEV
              ? viteEnv.VITE_AIR_JAM_PUBLIC_HOST.startsWith("https://")
                ? "standalone-secure"
                : "standalone-dev"
              : "self-hosted-production",
            surfaceRole: "host",
            appOrigin: viteEnv.VITE_AIR_JAM_PUBLIC_HOST,
            backendOrigin:
              viteEnv.VITE_AIR_JAM_SERVER_URL ||
              viteEnv.VITE_AIR_JAM_PUBLIC_HOST,
            publicHost: viteEnv.VITE_AIR_JAM_PUBLIC_HOST,
            secureTransport:
              viteEnv.VITE_AIR_JAM_PUBLIC_HOST.startsWith("https://"),
          })
        : null;
    return {
      ...(explicitTopology || projectTopology
        ? { topology: explicitTopology ?? projectTopology ?? undefined }
        : {}),
      appId: viteEnv?.VITE_AIR_JAM_APP_ID,
      hostGrantEndpoint: viteEnv?.VITE_AIR_JAM_HOST_GRANT_ENDPOINT,
      resolveEnv: explicitTopology || projectTopology ? false : true,
    };
  },
  next: (): ResolveAirJamConfigInput => ({
    resolveEnv: true,
  }),
  explicit: (
    runtime: Omit<ResolveAirJamConfigInput, "resolveEnv">,
  ): ResolveAirJamConfigInput => ({
    ...runtime,
    resolveEnv: false,
  }),
} as const;

export const createAirJamApp = <TSchema extends z.ZodSchema = z.ZodSchema>({
  runtime = {},
  game,
  input,
  errorBoundary,
}: CreateAirJamAppOptions<TSchema> = {}): AirJamApp<TSchema> => {
  const controllerPath = resolveControllerPath(game?.controllerPath);

  const hostSession: HostSessionProps<TSchema> = input
    ? {
        ...runtime,
        hostSessionKind: runtime.hostSessionKind ?? "game",
        input,
      }
    : {
        ...runtime,
        hostSessionKind: runtime.hostSessionKind ?? "game",
      };

  const controllerSession: ControllerSessionProps = {
    ...runtime,
  };

  const Host = ({
    children,
    ...runtimeOptions
  }: AirJamHostOptions & { children: ReactNode }): JSX.Element => {
    const hostErrorBoundary = errorBoundary?.host;
    return (
      <AirJamErrorBoundary
        role="host"
        roomId={runtimeOptions.roomId}
        appId={hostSession.appId}
        renderFallback={hostErrorBoundary?.renderFallback}
        onError={hostErrorBoundary?.onError}
      >
        <AirJamHostRuntime<TSchema> {...hostSession} {...runtimeOptions}>
          {children}
        </AirJamHostRuntime>
      </AirJamErrorBoundary>
    );
  };

  const Controller = ({
    children,
    ...runtimeOptions
  }: AirJamControllerOptions & { children: ReactNode }): JSX.Element => {
    const controllerErrorBoundary = errorBoundary?.controller;
    return (
      <AirJamErrorBoundary
        role="controller"
        roomId={runtimeOptions.roomId}
        appId={controllerSession.appId}
        renderFallback={controllerErrorBoundary?.renderFallback}
        onError={controllerErrorBoundary?.onError}
      >
        <AirJamControllerRuntime {...controllerSession} {...runtimeOptions}>
          {children}
        </AirJamControllerRuntime>
      </AirJamErrorBoundary>
    );
  };

  return {
    Host,
    Controller,
    paths: {
      controller: controllerPath,
    },
    session: {
      host: hostSession,
      controller: controllerSession,
    },
    runtime,
    game: {
      controllerPath,
      capabilities: game?.capabilities,
      machine: game?.machine,
    },
  };
};
