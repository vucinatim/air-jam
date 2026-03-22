import { z } from "zod";
import { roomCodeSchema, type RoomCode } from "./core";
import type { ErrorCode } from "./errors";
import { runtimeUrlSchema } from "./url-policy";

export interface HostRegistrationAck {
  ok: boolean;
  roomId?: RoomCode;
  message?: string;
  code?: ErrorCode | string;
}

export const hostRegisterSystemSchema = z.object({
  roomId: roomCodeSchema,
  apiKey: z.string().optional(),
});

export type HostRegisterSystemPayload = z.infer<typeof hostRegisterSystemSchema>;

export const systemLaunchGameSchema = z.object({
  roomId: roomCodeSchema,
  gameId: z.string(),
  gameUrl: runtimeUrlSchema,
});

export type SystemLaunchGamePayload = z.infer<typeof systemLaunchGameSchema>;

export const hostJoinAsChildSchema = z.object({
  roomId: roomCodeSchema,
  joinToken: z.string(),
});

export type HostJoinAsChildPayload = z.infer<typeof hostJoinAsChildSchema>;

export const hostCreateRoomSchema = z.object({
  maxPlayers: z.number().int().min(1).max(16).default(8),
  apiKey: z.string().optional(),
});

export type HostCreateRoomPayload = z.infer<typeof hostCreateRoomSchema>;

export const hostReconnectSchema = z.object({
  roomId: roomCodeSchema,
  apiKey: z.string().optional(),
});

export type HostReconnectPayload = z.infer<typeof hostReconnectSchema>;

export interface SystemLaunchGameAck {
  ok: boolean;
  joinToken?: string;
  message?: string;
  code?: ErrorCode | string;
}

export interface ClientLoadUiPayload {
  url: string;
}
