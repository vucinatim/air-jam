import { z } from "zod";

export const gameInputSchema = z.object({
  action: z.boolean(),
});

export type GameInput = z.infer<typeof gameInputSchema>;
