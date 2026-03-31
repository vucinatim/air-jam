import type { JSX, ReactNode } from "react";
import type { z } from "zod";
import { CONTROLLER_PATH } from "../constants";
import {
  type AirJamProviderProps,
} from "../context/session-providers";
import type { AirJamControllerOptions } from "../hooks/use-air-jam-controller";
import type { AirJamHostOptions } from "../hooks/use-air-jam-host";
import {
  AirJamControllerRuntime,
  AirJamHostRuntime,
} from "./session-runtimes";
import type { ResolveAirJamConfigInput } from "./air-jam-config";

type HostSessionProps<TSchema extends z.ZodSchema> = Omit<
  AirJamProviderProps<TSchema>,
  "children"
>;

type ControllerSessionProps = Omit<AirJamProviderProps, "children" | "input">;

export interface AirJamGameMetadata {
  /**
   * Controller route path relative to the game origin.
   * Defaults to "/controller".
   */
  controllerPath?: string;
}

export interface CreateAirJamAppOptions<
  TSchema extends z.ZodSchema = z.ZodSchema,
> {
  runtime?: ResolveAirJamConfigInput;
  game?: AirJamGameMetadata;
  input?: AirJamProviderProps<TSchema>["input"];
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
}

const resolveControllerPath = (controllerPath?: string): string => {
  const normalized = controllerPath ?? CONTROLLER_PATH;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
};

export interface ViteEnvLike {
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
    return {
      serverUrl: viteEnv?.VITE_AIR_JAM_SERVER_URL,
      appId: viteEnv?.VITE_AIR_JAM_APP_ID,
      hostGrantEndpoint: viteEnv?.VITE_AIR_JAM_HOST_GRANT_ENDPOINT,
      publicHost: viteEnv?.VITE_AIR_JAM_PUBLIC_HOST,
      resolveEnv: true,
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
    return (
      <AirJamHostRuntime<TSchema> {...hostSession} {...runtimeOptions}>
        {children}
      </AirJamHostRuntime>
    );
  };

  const Controller = ({
    children,
    ...runtimeOptions
  }: AirJamControllerOptions & { children: ReactNode }): JSX.Element => {
    return (
      <AirJamControllerRuntime {...controllerSession} {...runtimeOptions}>
        {children}
      </AirJamControllerRuntime>
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
  };
};
