import { z } from "zod";

export const gameInputSchema = z.object({
  vertical: z.number().min(-1).max(1),
  horizontal: z.number().min(-1).max(1),
  leftPunch: z.boolean(),
  rightPunch: z.boolean(),
  defend: z.boolean(),
});

export type GameInput = z.infer<typeof gameInputSchema>;
