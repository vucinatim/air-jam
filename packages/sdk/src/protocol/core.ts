import { z } from "zod";

export type RoomCode = string;

export type ConnectionRole = "host" | "controller";

export const connectionStatusSchema = z.enum([
  "idle",
  "connecting",
  "connected",
  "disconnected",
  "reconnecting",
]);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export type RunMode = "standalone" | "platform";

export const runtimeStateSchema = z.enum(["paused", "playing"]);
export type RuntimeState = z.infer<typeof runtimeStateSchema>;

export const roomCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(8)
  .regex(/^[A-Z0-9]+$/, { message: "room code must contain only A-Z or 0-9" });
