import { z } from "zod";
export const dependencyInstallObservationSchema = z.object({
  durationMs: z.number().nonnegative(),
  packageCount: z.number().int().nonnegative(),
  reused: z.number().int().nonnegative(),
  downloaded: z.number().int().nonnegative(),
  added: z.number().int().nonnegative(),
  importMethods: z.array(z.string()).optional(),
  stages: z.array(
    z.object({ stage: z.string(), offsetMs: z.number().nonnegative() }),
  ),
});
