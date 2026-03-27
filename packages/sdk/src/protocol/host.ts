import { z } from "zod";
import { roomCodeSchema, type RoomCode } from "./core";
import type { ErrorCode } from "./errors";
import type { PlayerProfile } from "./controller";

export const childHostCapabilitySchema = z.object({
  token: z.string().min(1),
  expiresAt: z.number().int().positive(),
});

export type ChildHostCapability = z.infer<typeof childHostCapabilitySchema>;

/**
 * Active arcade game session as seen by the server (launch capability + catalog id).
 * Returned on host reconnect so the platform can restore iframe + replicated surface after refresh.
 */
export interface HostArcadeSessionSnapshot {
  gameId: string;
  launchCapability: ChildHostCapability;
}

export interface HostRegistrationAck {
  ok: boolean;
  roomId?: RoomCode;
  message?: string;
  code?: ErrorCode | string;
  /** When reconnecting, present if the room still has a launched game (launch pending or active). */
  arcadeSession?: HostArcadeSessionSnapshot;
  /** Authoritative controller roster snapshot for the connected room. */
  players?: PlayerProfile[];
}

export interface HostBootstrapAck {
  ok: boolean;
  message?: string;
  code?: ErrorCode | string;
  traceId?: string;
}

export interface HostSocketAuthority {
  appId?: string;
  traceId: string;
  verifiedAt: number;
  verifiedVia?: "appId" | "hostGrant";
  verifiedOrigin?: string;
}

export const hostBootstrapSchema = z.object({
  appId: z.string().optional(),
  hostGrant: z.string().min(1).optional(),
});

export type HostBootstrapPayload = z.infer<typeof hostBootstrapSchema>;

export const hostRegisterSystemSchema = z.object({
  roomId: roomCodeSchema,
});

export type HostRegisterSystemPayload = z.infer<typeof hostRegisterSystemSchema>;

export const systemLaunchGameSchema = z.object({
  roomId: roomCodeSchema,
  gameId: z.string(),
});

export type SystemLaunchGamePayload = z.infer<typeof systemLaunchGameSchema>;

export const hostJoinAsChildSchema = z.object({
  roomId: roomCodeSchema,
  capabilityToken: z.string().min(1),
});

export type HostJoinAsChildPayload = z.infer<typeof hostJoinAsChildSchema>;

export const hostActivateEmbeddedGameSchema = z.object({
  roomId: roomCodeSchema,
  capabilityToken: z.string().min(1),
});

export type HostActivateEmbeddedGamePayload = z.infer<
  typeof hostActivateEmbeddedGameSchema
>;

export const hostCreateRoomSchema = z.object({
  maxPlayers: z.number().int().min(1).max(16).default(8),
});

export type HostCreateRoomPayload = z.infer<typeof hostCreateRoomSchema>;

export const hostReconnectSchema = z.object({
  roomId: roomCodeSchema,
});

export type HostReconnectPayload = z.infer<typeof hostReconnectSchema>;

export interface SystemLaunchGameAck {
  ok: boolean;
  launchCapability?: ChildHostCapability;
  message?: string;
  code?: ErrorCode | string;
}
