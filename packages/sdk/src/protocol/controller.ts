import { z } from "zod";
import { roomCodeSchema, type RoomCode } from "./core";
import type { ErrorCode } from "./errors";

export const controllerInputSchema = z.object({
  roomId: roomCodeSchema,
  controllerId: z.string().min(3),
  input: z.record(z.string(), z.unknown()),
});

export type ControllerInputPayload = Record<string, unknown>;

export interface ControllerInputEvent {
  roomId: RoomCode;
  controllerId: string;
  input: ControllerInputPayload;
}

export const controllerStateSchema = z.object({
  roomId: roomCodeSchema,
  state: z.object({
    orientation: z.enum(["portrait", "landscape"]).optional(),
    message: z.string().optional(),
    gameState: z.enum(["paused", "playing"]).optional(),
  }),
});

export type ControllerStateMessage = z.infer<typeof controllerStateSchema>;

export type ControllerStatePayload = z.infer<typeof controllerStateSchema>["state"];

export const controllerJoinSchema = z.object({
  roomId: roomCodeSchema,
  controllerId: z.string().min(3),
  nickname: z.string().trim().min(1).max(24).optional(),
});

export type ControllerJoinPayload = z.infer<typeof controllerJoinSchema>;

export const controllerLeaveSchema = z.object({
  roomId: roomCodeSchema,
  controllerId: z.string().min(3),
});

export type ControllerLeavePayload = z.infer<typeof controllerLeaveSchema>;

export const controllerSystemSchema = z.object({
  roomId: roomCodeSchema,
  command: z.enum(["exit", "ready", "toggle_pause"]),
});

export type ControllerSystemPayload = z.infer<typeof controllerSystemSchema>;

export interface PlayerProfile {
  id: string;
  label: string;
  color?: string;
}

export interface ControllerJoinAck {
  ok: boolean;
  controllerId?: string;
  roomId?: RoomCode;
  message?: string;
  code?: ErrorCode | string;
}
