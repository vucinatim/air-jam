import { z } from "zod";

// Define the input schema for your game
// This determines what data the controller sends to the host
export const gameInputSchema = z.object({
  // Paddle movement: -1 (up), 0 (still), 1 (down)
  direction: z.number().min(-1).max(1),
});

export type GameInput = z.infer<typeof gameInputSchema>;
