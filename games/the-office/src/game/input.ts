import { z } from "zod";

export const gameInputSchema = z.object({
  movementX: z.number().min(-1).max(1),
  movementY: z.number().min(-1).max(1),
  action: z.boolean(),
});

export type GameInput = z.infer<typeof gameInputSchema>;
