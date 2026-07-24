import {
  isLocalDevControlSurfaceTopology,
  parseRuntimeTopology,
  resolveRuntimeTopology,
} from "@air-jam/sdk/runtime-topology";
import { z } from "zod";

export const arcadeInputSchema = z.object({
  vector: z.object({
    x: z.number(),
    y: z.number(),
  }),
  action: z.boolean(),
});

const PLATFORM_ARCADE_MAX_PLAYERS = 16;

export const resolvePlatformTopology = (
  envKey:
    | "NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY"
    | "NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY",
) => {
  const serialized =
    envKey === "NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY"
      ? process.env.NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY
      : process.env.NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY;
  if (!serialized) {
    throw new Error(
      `Missing required platform runtime topology env: ${envKey}.`,
    );
  }

  const topology = parseRuntimeTopology(serialized);
  if (
    typeof window === "undefined" ||
    !isLocalDevControlSurfaceTopology(topology) ||
    topology.proxyStrategy !== "platform-proxy"
  ) {
    return topology;
  }

  const actualOrigin = window.location.origin;
  if (!actualOrigin || actualOrigin === topology.appOrigin) {
    return topology;
  }

  return resolveRuntimeTopology({
    ...topology,
    appOrigin: actualOrigin,
    socketOrigin: actualOrigin,
  });
};

// These reads must use literal `process.env.X` references so Next.js can
// statically replace them at build time. Calling
// `resolvePlatformDeploymentConfig(process.env)` from client code does not
// work — Next.js only inlines literal accesses, not parameter passes.
const trimOrUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const resolveClientAppId = () =>
  trimOrUndefined(process.env.NEXT_PUBLIC_AIR_JAM_APP_ID);

const resolveClientHostGrantEndpoint = () =>
  trimOrUndefined(process.env.NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT) ??
  (process.env.NODE_ENV === "production"
    ? "/api/airjam/host-grant"
    : undefined);

export const getPlatformControllerSessionConfig = () => {
  return {
    topology: resolvePlatformTopology(
      "NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY",
    ),
    appId: resolveClientAppId(),
  };
};

export const getPlatformArcadeHostSessionConfig = () => {
  return {
    topology: resolvePlatformTopology(
      "NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY",
    ),
    appId: resolveClientAppId(),
    hostGrantEndpoint: resolveClientHostGrantEndpoint(),
    hostSessionKind: "system" as const,
    // The Arcade room exists before a game is selected, so it must support
    // the full framework capacity rather than the SDK's per-game default.
    maxPlayers: PLATFORM_ARCADE_MAX_PLAYERS,
    input: {
      schema: arcadeInputSchema,
    },
  };
};
