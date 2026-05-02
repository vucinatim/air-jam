/**
 * Controller → host input schema.
 *
 * This template doesn't use the input lane — a "tap" is a discrete event, so
 * it's dispatched through the state lane (store actions) instead of
 * published per-frame. The SDK still requires declaring an input shape, so
 * we pass an empty object.
 *
 * When you start building something that needs continuous input (joystick,
 * paddle, accelerometer), replace the empty object with fields like
 * `{ direction: z.number().min(-1).max(1) }` and consume them on the host
 * via `host.getInput(playerId)`. The pong template is a worked example.
 */
import { z } from "zod";

export const gameInputSchema = z.object({});

export type GameInput = z.infer<typeof gameInputSchema>;
