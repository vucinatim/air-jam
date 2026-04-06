import { parseRuntimeTopology } from "@air-jam/runtime-topology";
import { z } from "zod";

export const arcadeInputSchema = z.object({
  vector: z.object({
    x: z.number(),
    y: z.number(),
  }),
  action: z.boolean(),
});

const resolvePlatformTopology = (
  envKey: "NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY" | "NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY",
) => {
  const serialized =
    envKey === "NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY"
      ? process.env.NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY
      : process.env.NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY;
  if (!serialized) {
    throw new Error(`Missing required platform runtime topology env: ${envKey}.`);
  }

  return parseRuntimeTopology(serialized);
};

export const platformControllerSessionConfig = {
  topology: resolvePlatformTopology(
    "NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY",
  ),
  appId: process.env.NEXT_PUBLIC_AIR_JAM_APP_ID,
  hostGrantEndpoint: process.env.NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT,
};

export const platformArcadeHostSessionConfig = {
  topology: resolvePlatformTopology("NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY"),
  appId: process.env.NEXT_PUBLIC_AIR_JAM_APP_ID,
  hostGrantEndpoint: process.env.NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT,
  hostSessionKind: "system" as const,
  input: {
    schema: arcadeInputSchema,
  },
};
