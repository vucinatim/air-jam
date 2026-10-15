import { z } from "zod";
import { roomCodeSchema } from "./core";

const stateSyncRequestIdSchema = z.string().trim().min(1).max(128);

export interface HostStateSyncPayload {
  roomId: string;
  data: Record<string, unknown>;
  /** Separates concurrent replicated stores in the same room (e.g. arcade shell vs game). */
  storeDomain: string;
  revision: number;
  requestId?: string;
}

export interface ControllerStateSyncRequestPayload {
  roomId: string;
  storeDomain: string;
  requestId?: string;
}

export type AirJamActionActorRole = "controller" | "host";

export interface AirJamActionActor {
  id: string;
  role: AirJamActionActorRole;
}

export type AirJamActionPayload = Record<string, unknown>;

export const airJamActionPayloadSchema = z.record(z.string(), z.unknown());

export const airJamActionAcceptedSchema = z.object({
  ok: z.literal(true),
  status: z.literal("accepted"),
  source: z.enum(["client", "host"]),
  result: z.unknown().optional(),
});
export const airJamActionRejectedSchema = z.object({
  ok: z.literal(false),
  status: z.literal("rejected"),
  source: z.enum(["client", "server", "host"]),
  reason: z.string(),
  message: z.string(),
  details: airJamActionPayloadSchema.optional(),
});
export const airJamActionInvocationResultSchema = z.discriminatedUnion(
  "status",
  [airJamActionAcceptedSchema, airJamActionRejectedSchema],
);
export type AirJamActionAccepted<TResult = unknown> = Omit<
  z.infer<typeof airJamActionAcceptedSchema>,
  "result"
> & { result?: TResult };
export type AirJamActionRejected = z.infer<typeof airJamActionRejectedSchema>;

export type AirJamActionInvocationResult<TResult = unknown> =
  | AirJamActionAccepted<TResult>
  | AirJamActionRejected;

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
  revision: number;
  requestId?: string;
}

export interface AirJamStateSyncRequestPayload {
  roomId: string;
  storeDomain: string;
  requestId?: string;
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
    payload: z.union([airJamActionPayloadSchema, z.undefined()]).optional(),
    storeDomain: z.string().trim().min(1).max(128),
  })
  .strict();

export const hostStateSyncSchema = z
  .object({
    roomId: roomCodeSchema,
    data: z.record(z.string(), z.unknown()),
    storeDomain: z.string().trim().min(1).max(128),
    revision: z.number().int().nonnegative(),
    requestId: stateSyncRequestIdSchema.optional(),
  })
  .strict();

export const controllerStateSyncRequestSchema = z
  .object({
    roomId: roomCodeSchema,
    storeDomain: z.string().trim().min(1).max(128),
    requestId: stateSyncRequestIdSchema.optional(),
  })
  .strict();
