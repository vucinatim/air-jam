import { z } from "zod";
import { roomCodeSchema } from "./core";

export interface HostStateSyncPayload {
  roomId: string;
  data: Record<string, unknown>;
  /** Separates concurrent replicated stores in the same room (e.g. arcade shell vs game). */
  storeDomain: string;
}

export interface ControllerStateSyncRequestPayload {
  roomId: string;
  storeDomain: string;
}

export type AirJamActionActorRole = "controller" | "host";

export interface AirJamActionActor {
  id: string;
  role: AirJamActionActorRole;
}

export type AirJamActionPayload = Record<string, unknown>;

export const airJamActionPayloadSchema = z.record(z.string(), z.unknown());

export interface ControllerActionRpcPayload {
  roomId: string;
  actionName: string;
  payload: AirJamActionPayload | undefined;
  storeDomain: string;
}

export interface AirJamStateSyncPayload {
  roomId: string;
  data: Record<string, unknown>;
  storeDomain: string;
}

export interface AirJamStateSyncRequestPayload {
  roomId: string;
  storeDomain: string;
}

export interface AirJamActionRpcPayload {
  actionName: string;
  payload: AirJamActionPayload | undefined;
  actor: AirJamActionActor;
  storeDomain: string;
}

export const controllerActionRpcSchema = z
  .object({
    roomId: roomCodeSchema,
    actionName: z.string().trim().min(1),
    payload: z.union([airJamActionPayloadSchema, z.undefined()]),
    storeDomain: z.string().trim().min(1).max(128),
  })
  .strict();

export const hostStateSyncSchema = z
  .object({
    roomId: roomCodeSchema,
    data: z.record(z.string(), z.unknown()),
    storeDomain: z.string().trim().min(1).max(128),
  })
  .strict();

export const controllerStateSyncRequestSchema = z
  .object({
    roomId: roomCodeSchema,
    storeDomain: z.string().trim().min(1).max(128),
  })
  .strict();
