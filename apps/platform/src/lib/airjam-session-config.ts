import { z } from "zod";

export const arcadeInputSchema = z.object({
  vector: z.object({
    x: z.number(),
    y: z.number(),
  }),
  action: z.boolean(),
});

const resolvePlatformServerUrl = (): string | undefined => {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return process.env.NEXT_PUBLIC_AIR_JAM_SERVER_URL;
};

export const platformRuntimeConfig = {
  serverUrl: resolvePlatformServerUrl(),
  appId: process.env.NEXT_PUBLIC_AIR_JAM_APP_ID,
  hostGrantEndpoint: process.env.NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT,
  publicHost: process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST,
};

export const platformControllerSessionConfig = {
  ...platformRuntimeConfig,
};

export const platformArcadeHostSessionConfig = {
  ...platformRuntimeConfig,
  hostSessionKind: "system" as const,
  input: {
    schema: arcadeInputSchema,
  },
};
