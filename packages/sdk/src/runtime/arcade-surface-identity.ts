import { z } from "zod";

/**
 * Minimum Arcade surface identity for embedded runtime bridge attach (see docs/systems/arcade-surface-contract.md).
 */
export const arcadeSurfaceRuntimeIdentitySchema = z
  .object({
    epoch: z.number().int().nonnegative(),
    kind: z.enum(["browser", "game"]),
    gameId: z.string().nullable(),
  })
  .strict();

export type ArcadeSurfaceRuntimeIdentity = z.infer<
  typeof arcadeSurfaceRuntimeIdentitySchema
>;
