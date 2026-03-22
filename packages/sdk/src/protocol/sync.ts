import { z } from "zod";
import { roomCodeSchema } from "./core";

export interface HostStateSyncPayload {
  roomId: string;
  data: Record<string, unknown>;
}

export type AirJamActionActorRole = "controller" | "host";

export interface AirJamActionActor {
  id: string;
  role: AirJamActionActorRole;
}

export interface ControllerActionRpcPayload {
  roomId: string;
  actionName: string;
  payload: unknown;
}

export interface AirJamStateSyncPayload {
  roomId: string;
  data: Record<string, unknown>;
}

export interface AirJamActionRpcPayload {
  actionName: string;
  payload: unknown;
  actor: AirJamActionActor;
}

export const controllerActionRpcSchema = z
  .object({
    roomId: roomCodeSchema,
    actionName: z.string().trim().min(1),
    payload: z.unknown(),
  })
  .strict();
