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

export const controllerInputSchema = z.object({
  roomId: roomCodeSchema,
  controllerId: z.string().min(3),
  input: z.object({
    vector: z.object({
      x: z.number().finite(),
      y: z.number().finite(),
    }),
    action: z.boolean(),
    ability: z.boolean().optional(),
    timestamp: z.number().int().nonnegative(),
    togglePlayPause: z.boolean().optional(),
  }),
});

export type ControllerInputPayload = z.infer<
  typeof controllerInputSchema
>["input"];

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
    vibration: z.enum(["short", "long"]).optional(),
    gameState: z.enum(["paused", "playing"]).optional(),
  }),
});

export type ControllerStateMessage = z.infer<typeof controllerStateSchema>;

export type ControllerStatePayload = z.infer<
  typeof controllerStateSchema
>["state"];

export const hostRegistrationSchema = z.object({
  roomId: roomCodeSchema,
  maxPlayers: z.number().int().min(1).max(16).default(8),
});

export const controllerJoinSchema = z.object({
  roomId: roomCodeSchema,
  controllerId: z.string().min(3),
  nickname: z.string().trim().min(1).max(24).optional(),
});

export const controllerLeaveSchema = z.object({
  roomId: roomCodeSchema,
  controllerId: z.string().min(3),
});

export interface PlayerProfile {
  id: string;
  label: string;
}

export interface HostRegistrationAck {
  ok: boolean;
  roomId?: RoomCode;
  message?: string;
}

export interface ControllerJoinAck {
  ok: boolean;
  controllerId?: string;
  roomId?: RoomCode;
  message?: string;
}

export interface ServerErrorPayload {
  code: "ROOM_NOT_FOUND" | "ROOM_FULL" | "INVALID_PAYLOAD" | "SERVER_ERROR";
  message: string;
}

export interface ControllerWelcomePayload {
  controllerId: string;
  roomId: RoomCode;
}

export interface ControllerJoinedNotice {
  controllerId: string;
  nickname?: string;
}

export interface ControllerLeftNotice {
  controllerId: string;
}

export interface RoomReadyNotice {
  roomId: RoomCode;
}

export interface HostLeftNotice {
  roomId: RoomCode;
  reason: string;
}

export interface ClientToServerEvents {
  "host:register": (
    payload: z.infer<typeof hostRegistrationSchema>,
    callback: (ack: HostRegistrationAck) => void
  ) => void;
  "host:state": (payload: z.infer<typeof controllerStateSchema>) => void;
  "controller:join": (
    payload: z.infer<typeof controllerJoinSchema>,
    callback: (ack: ControllerJoinAck) => void
  ) => void;
  "controller:leave": (payload: z.infer<typeof controllerLeaveSchema>) => void;
  "controller:input": (payload: z.infer<typeof controllerInputSchema>) => void;
}

export interface ServerToClientEvents {
  "server:room_ready": (payload: RoomReadyNotice) => void;
  "server:controller_joined": (payload: ControllerJoinedNotice) => void;
  "server:controller_left": (payload: ControllerLeftNotice) => void;
  "server:input": (payload: ControllerInputEvent) => void;
  "server:error": (payload: ServerErrorPayload) => void;
  "server:state": (payload: z.infer<typeof controllerStateSchema>) => void;
  "server:welcome": (payload: ControllerWelcomePayload) => void;
  "server:host_left": (payload: HostLeftNotice) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export type SocketData = Record<string, unknown>;
