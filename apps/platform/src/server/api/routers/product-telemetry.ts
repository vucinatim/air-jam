import { productTelemetryDeploymentEnvironmentSchema } from "@/lib/product-telemetry-contract";
import { getProductTelemetryOpsOverview } from "@/server/product-telemetry/reporting";
import { z } from "zod";
import { createTRPCRouter, opsProcedure } from "../trpc";

export const productTelemetryRouter = createTRPCRouter({
  getOpsOverview: opsProcedure
    .input(
      z
        .object({
          days: z.union([z.literal(7), z.literal(30), z.literal(90)]),
          deploymentEnvironment: productTelemetryDeploymentEnvironmentSchema,
        })
        .strict(),
    )
    .query(async ({ input }) => getProductTelemetryOpsOverview(input)),
});
