import { z } from "zod";

export const arcadeInputSchema = z.object({
  vector: z.object({
    x: z.number(),
    y: z.number(),
  }),
  action: z.boolean(),
});

export const platformRuntimeConfig = {
  serverUrl: process.env.NEXT_PUBLIC_AIR_JAM_SERVER_URL,
};

export const platformControllerSessionConfig = {
  ...platformRuntimeConfig,
};

export const platformArcadeHostSessionConfig = {
  ...platformRuntimeConfig,
  input: {
    schema: arcadeInputSchema,
  },
};
