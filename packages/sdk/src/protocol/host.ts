import { z } from "zod";
import { roomCodeSchema, type RoomCode } from "./core";
import type { ErrorCode } from "./errors";

/**
 * Active arcade game session as seen by the server (join token + catalog id).
 * Returned on host reconnect so the platform can restore iframe + replicated surface after refresh.
 */
export interface HostArcadeSessionSnapshot {
  gameId: string;
  joinToken: string;
}

export interface HostRegistrationAck {
  ok: boolean;
  roomId?: RoomCode;
  message?: string;
  code?: ErrorCode | string;
  /** When reconnecting, present if the room still has a launched game (launch pending or active). */
  arcadeSession?: HostArcadeSessionSnapshot;
}

export const hostRegisterSystemSchema = z.object({
  roomId: roomCodeSchema,
  apiKey: z.string().optional(),
});

export type HostRegisterSystemPayload = z.infer<typeof hostRegisterSystemSchema>;

export const systemLaunchGameSchema = z.object({
  roomId: roomCodeSchema,
  gameId: z.string(),
});

export type SystemLaunchGamePayload = z.infer<typeof systemLaunchGameSchema>;

export const hostJoinAsChildSchema = z.object({
  roomId: roomCodeSchema,
  joinToken: z.string(),
});

export type HostJoinAsChildPayload = z.infer<typeof hostJoinAsChildSchema>;

export const hostActivateEmbeddedGameSchema = z.object({
  roomId: roomCodeSchema,
  joinToken: z.string(),
});

export type HostActivateEmbeddedGamePayload = z.infer<
  typeof hostActivateEmbeddedGameSchema
>;

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
