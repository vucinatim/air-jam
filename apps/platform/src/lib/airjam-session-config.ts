import {
  isLocalDevControlSurfaceTopology,
  parseRuntimeTopology,
  resolveRuntimeTopology,
} from "@air-jam/sdk/runtime-topology";
import { z } from "zod";
import { resolvePlatformDeploymentConfig } from "./platform-deployment-config";

export const arcadeInputSchema = z.object({
  vector: z.object({
    x: z.number(),
    y: z.number(),
  }),
  action: z.boolean(),
});

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

export const getPlatformControllerSessionConfig = () => {
  const deploymentConfig = resolvePlatformDeploymentConfig(process.env);

  return {
    topology: resolvePlatformTopology(
      "NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY",
    ),
    appId: deploymentConfig.appId,
  };
};

export const getPlatformArcadeHostSessionConfig = () => {
  const deploymentConfig = resolvePlatformDeploymentConfig(process.env);

  return {
    topology: resolvePlatformTopology(
      "NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY",
    ),
    appId: deploymentConfig.appId,
    hostGrantEndpoint: deploymentConfig.systemHostGrantEndpoint,
    hostSessionKind: "system" as const,
    input: {
      schema: arcadeInputSchema,
    },
  };
};
