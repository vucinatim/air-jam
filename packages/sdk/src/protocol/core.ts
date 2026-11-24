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
