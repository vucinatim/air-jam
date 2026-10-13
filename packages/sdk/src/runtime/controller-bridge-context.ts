import { z } from "zod";
import { arcadeSurfaceRuntimeIdentitySchema } from "./arcade-surface-identity";

export const controllerBridgeContextSchema = z.union([
  z.object({ arcadeSurface: arcadeSurfaceRuntimeIdentitySchema }).strict(),
  z.object({ harnessSessionId: z.uuid() }).strict(),
]);
export type ControllerBridgeContext = z.infer<
  typeof controllerBridgeContextSchema
>;

export function controllerBridgeContext(
  context: ControllerBridgeContext,
): ControllerBridgeContext {
  return "arcadeSurface" in context
    ? { arcadeSurface: context.arcadeSurface }
    : { harnessSessionId: context.harnessSessionId };
}

export function withControllerBridgeContext<Shape extends z.ZodRawShape>(
  shape: Shape,
) {
  return z.union([
    z
      .object({ ...shape, arcadeSurface: arcadeSurfaceRuntimeIdentitySchema })
      .strict(),
    z.object({ ...shape, harnessSessionId: z.uuid() }).strict(),
  ]);
}
