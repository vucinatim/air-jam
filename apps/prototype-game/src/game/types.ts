import { z } from "zod";

/**
 * Game-specific input schema (this game uses vector/action/ability pattern)
 * Other games can define their own input structures
 */
export const gameInputSchema = z.object({
  vector: z.object({
    x: z.number(),
    y: z.number(),
  }),
  action: z.boolean(),
  ability: z.boolean(),
  timestamp: z.number(),
});

/**
 * Game-specific input type inferred from schema
 */
export type GameLoopInput = z.infer<typeof gameInputSchema>;

