import type { JSX, ReactNode } from "react";
import type { AirJamAgentContract } from "../agent/agent-contract";
import { CONTROLLER_PATH } from "../constants";
import { type AirJamProviderProps } from "../context/session-providers";
import { HostRuntime, type HostRuntimeFactory } from "../core/host-runtime";
import type { AirJamInput } from "../core/input";
import type { AirJamInputBindings } from "../core/input-bindings";
import type { AttachableStore } from "../core/replicated-store";
import type { AirJamSimulationDeclaration } from "../core/simulation";
import type { AirJamControllerOptions } from "../hooks/use-air-jam-controller";
import type { AirJamHostOptions } from "../hooks/use-air-jam-host";
import type { AirJamGameMetadata } from "../metadata/manifest";
import {
  parseRuntimeTopology,
  resolveProjectRuntimeTopology,
} from "../runtime-topology";
import {
  resolveEnvironmentRuntimeTopology,
  type ResolveAirJamConfigInput,
} from "./air-jam-config";
import {
  AirJamErrorBoundary,
  type AirJamErrorBoundaryProps,
  type AirJamErrorFallbackRenderer,
} from "./air-jam-error-boundary";
import { ConnectedRuntimeErrorBoundary } from "./connected-runtime-error-boundary";
import { AirJamControllerRuntime, AirJamHostRuntime } from "./session-runtimes";

type HostSessionProps = Omit<AirJamProviderProps, "children">;

type ControllerSessionProps = Omit<AirJamProviderProps, "children">;

export interface AirJamRuntimeErrorBoundaryOptions {
  renderFallback?: AirJamErrorFallbackRenderer;
  onError?: AirJamErrorBoundaryProps["onError"];
}

export interface AirJamAppErrorBoundaryOptions {
  host?: AirJamRuntimeErrorBoundaryOptions;
  controller?: AirJamRuntimeErrorBoundaryOptions;
}

export interface CreateAirJamAppOptions {
  runtime?: ResolveAirJamConfigInput;
  metadata?: AirJamGameMetadata;
  /**
   * Controller route path relative to the app origin.
   * Defaults to "/controller".
   */
  controllerPath?: string;
  /**
   * Optional semantic agent contract published by the app.
   */
  agent?: AirJamAgentContract;
  /** Project-relative devtools test profiles module. Never imported by the game runtime. */
  testing?: string;
  /** The game's networked stores; host and controller sync them while they run. */
  stores?: readonly AttachableStore[];
  /**
   * The game's simulation, advanced on the SDK clock while the host runs.
   * Pass a loader (`() => import(...)`) when its code is heavy, such as a
   * physics engine, so controllers never download it.
   */
  simulation?: AirJamSimulationDeclaration;
  /**
   * The controls the game reads from each player, from `defineAirJamInput`.
   * The host applies them once per simulation step.
   */
  input?: AirJamInput;
  /**
   * Keyboard layouts and gamepads that play the declared input as local
   * players without a phone, from `defineAirJamInputBindings`.
   */
  inputBindings?: AirJamInputBindings;
  errorBoundary?: AirJamAppErrorBoundaryOptions;
}

export interface AirJamApp {
  Host: (props: AirJamHostOptions & { children: ReactNode }) => JSX.Element;
  Controller: (
    props: AirJamControllerOptions & { children: ReactNode },
  ) => JSX.Element;
  paths: {
    controller: string;
  };
  session: {
    host: HostSessionProps;
    controller: ControllerSessionProps;
  };
  runtime: ResolveAirJamConfigInput;
  metadata?: AirJamGameMetadata;
  controllerPath: string;
  agent?: AirJamAgentContract;
  testing?: string;
  stores: readonly AttachableStore[];
  simulation?: AirJamSimulationDeclaration;
  input?: AirJamInput;
  /**
   * Builds this game's host core without React or a page, such as for a
   * headless room. It comes from the game's own SDK, so the game's stores
   * and its host share one runtime.
   */
  createHostRuntime: HostRuntimeFactory;
}

const NO_STORES: readonly AttachableStore[] = [];

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
    const candidate = import.meta as ImportMeta & { env?: ViteEnvLike };
    if (candidate && typeof candidate.env === "object") {
      return candidate.env;
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
      ? parseRuntimeTopology(viteEnv.VITE_AIR_JAM_RUNTIME_TOPOLOGY)
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
    const topology = resolveEnvironmentRuntimeTopology(
      explicitTopology ?? projectTopology,
      viteEnv?.DEV === true,
    );
    return {
      ...(topology ? { topology } : {}),
      appId: viteEnv?.VITE_AIR_JAM_APP_ID,
      hostGrantEndpoint: viteEnv?.VITE_AIR_JAM_HOST_GRANT_ENDPOINT,
      resolveEnv: topology ? false : true,
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

export const createAirJamApp = ({
  runtime = {},
  metadata,
  controllerPath: requestedControllerPath,
  agent,
  testing,
  stores = NO_STORES,
  simulation,
  input,
  inputBindings,
  errorBoundary,
}: CreateAirJamAppOptions = {}): AirJamApp => {
  if (inputBindings && !input)
    throw new Error("inputBindings need the input they bind; pass input too.");
  const controllerPath = resolveControllerPath(requestedControllerPath);

  const hostSession: HostSessionProps = {
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
        <AirJamHostRuntime
          {...hostSession}
          {...runtimeOptions}
          agent={agent}
          gameId={metadata?.slug}
          stores={stores}
          simulation={simulation}
          input={input}
          inputBindings={inputBindings}
        >
          <ConnectedRuntimeErrorBoundary
            role="host"
            roomId={runtimeOptions.roomId}
            appId={hostSession.appId}
            renderFallback={hostErrorBoundary?.renderFallback}
            onError={hostErrorBoundary?.onError}
          >
            {children}
          </ConnectedRuntimeErrorBoundary>
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
        <AirJamControllerRuntime
          {...controllerSession}
          {...runtimeOptions}
          stores={stores}
          input={input}
        >
          <ConnectedRuntimeErrorBoundary
            role="controller"
            roomId={runtimeOptions.roomId}
            appId={controllerSession.appId}
            renderFallback={controllerErrorBoundary?.renderFallback}
            onError={controllerErrorBoundary?.onError}
          >
            {children}
          </ConnectedRuntimeErrorBoundary>
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
    metadata,
    controllerPath,
    agent,
    testing,
    stores,
    simulation,
    input,
    createHostRuntime: (dependencies, options) =>
      new HostRuntime(
        {
          ...dependencies,
          stores,
          simulation,
          input,
          agent: agent && {
            contract: agent,
            gameId: metadata?.slug ?? "game",
          },
        },
        options,
      ),
  };
};
