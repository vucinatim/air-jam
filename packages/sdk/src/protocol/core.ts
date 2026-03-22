import { z } from "zod";

export type RoomCode = string;

export type ConnectionRole = "host" | "controller";

export type ConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting";

export type RunMode = "standalone" | "platform";

export type GameState = "paused" | "playing";

export const roomCodeSchema = z
  .string()
  .trim()
  .min(4)
  .max(8)
  .regex(/^[A-Z0-9]+$/, { message: "room code must contain only A-Z or 0-9" });
