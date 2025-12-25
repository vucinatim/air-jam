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
  input: z.record(z.string(), z.unknown()), // Arbitrary JSON object - developers define their own structure
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

export type ControllerStatePayload = z.infer<
  typeof controllerStateSchema
>["state"];

export const hostRegistrationSchema = z.object({
  roomId: roomCodeSchema,
  maxPlayers: z.number().int().min(1).max(16).default(8),
  apiKey: z.string().optional(),
  mode: z.enum(["master", "child"]).default("child"),
  controllerUrl: z.string().url().optional(),
});

export type HostRegistrationPayload = z.infer<typeof hostRegistrationSchema>;

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

export interface PlayerProfile {
  id: string;
  label: string;
  color?: string;
}

export interface HostRegistrationAck {
  ok: boolean;
  roomId?: RoomCode;
  message?: string;
  code?: ErrorCode | string;
}

export interface ControllerJoinAck {
  ok: boolean;
  controllerId?: string;
  roomId?: RoomCode;
  message?: string;
  code?: ErrorCode | string;
}

export const controllerSystemSchema = z.object({
  roomId: roomCodeSchema,
  command: z.enum(["exit", "ready", "toggle_pause"]),
});

export type ControllerSystemPayload = z.infer<typeof controllerSystemSchema>;

/**
 * Standard error codes for Air Jam
 */
export enum ErrorCode {
  // Room errors
  ROOM_NOT_FOUND = "ROOM_NOT_FOUND",
  ROOM_FULL = "ROOM_FULL",

  // Auth errors
  INVALID_API_KEY = "INVALID_API_KEY",
  UNAUTHORIZED = "UNAUTHORIZED",

  // Token errors
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",

  // Connection errors
  CONNECTION_FAILED = "CONNECTION_FAILED",
  ALREADY_CONNECTED = "ALREADY_CONNECTED",

  // Validation errors
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  INVALID_ROOM_CODE = "INVALID_ROOM_CODE",

  // Server errors
  INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // Generic
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Standardized error payload
 */
export interface ServerErrorPayload {
  code: ErrorCode | string; // Allow custom codes
  message: string;
  details?: unknown;
}

export interface ControllerWelcomePayload {
  controllerId: string;
  roomId: RoomCode;
  player?: PlayerProfile;
}

export interface ControllerJoinedNotice {
  controllerId: string;
  nickname?: string;
  player?: PlayerProfile;
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

export type SignalType = "HAPTIC" | "TOAST";

export interface HapticSignalPayload {
  pattern: "light" | "medium" | "heavy" | "success" | "failure" | "custom";
  sequence?: number | number[];
}

export interface ToastSignalPayload {
  message: string;
  color?: string;
  duration?: number;
}

export type SignalPayload =
  | {
      targetId?: string;
      type: "HAPTIC";
      payload: HapticSignalPayload;
    }
  | {
      targetId?: string;
      type: "TOAST";
      payload: ToastSignalPayload;
    };

export interface PlaySoundEventPayload {
  roomId: string;
  targetControllerId?: string; // If null, broadcast to all
  soundId: string;
  volume?: number;
  loop?: boolean;
}

export const hostRegisterSystemSchema = z.object({
  roomId: roomCodeSchema,
  apiKey: z.string().optional(),
});

export type HostRegisterSystemPayload = z.infer<
  typeof hostRegisterSystemSchema
>;

export const systemLaunchGameSchema = z.object({
  roomId: roomCodeSchema,
  gameId: z.string(),
  gameUrl: z.string().url(),
});

export type SystemLaunchGamePayload = z.infer<typeof systemLaunchGameSchema>;

export const hostJoinAsChildSchema = z.object({
  roomId: roomCodeSchema,
  joinToken: z.string(),
});

export type HostJoinAsChildPayload = z.infer<typeof hostJoinAsChildSchema>;

export interface SystemLaunchGameAck {
  ok: boolean;
  joinToken?: string;
  message?: string;
  code?: ErrorCode | string;
}

export interface ClientLoadUiPayload {
  url: string;
}

export interface HostStateSyncPayload {
  roomId: string;
  data: Record<string, unknown>;
}

export interface ControllerActionRpcPayload {
  roomId: string;
  actionName: string;
  args: unknown[];
}

export interface AirJamStateSyncPayload {
  roomId: string;
  data: Record<string, unknown>;
}

export interface AirJamActionRpcPayload {
  actionName: string;
  args: unknown[];
  controllerId: string;
}

export interface ClientToServerEvents {
  "host:register": (
    payload: z.infer<typeof hostRegistrationSchema>,
    callback: (ack: HostRegistrationAck) => void,
  ) => void;
  "host:registerSystem": (
    payload: HostRegisterSystemPayload,
    callback: (ack: HostRegistrationAck) => void,
  ) => void;
  "system:launchGame": (
    payload: SystemLaunchGamePayload,
    callback: (ack: SystemLaunchGameAck) => void,
  ) => void;
  "host:joinAsChild": (
    payload: HostJoinAsChildPayload,
    callback: (ack: HostRegistrationAck) => void,
  ) => void;
  "system:closeGame": (payload: { roomId: string }) => void;
  "host:state": (payload: z.infer<typeof controllerStateSchema>) => void;
  "controller:join": (
    payload: z.infer<typeof controllerJoinSchema>,
    callback: (ack: ControllerJoinAck) => void,
  ) => void;
  "controller:leave": (payload: z.infer<typeof controllerLeaveSchema>) => void;
  "controller:input": (payload: z.infer<typeof controllerInputSchema>) => void;
  "controller:system": (
    payload: z.infer<typeof controllerSystemSchema>,
  ) => void;
  "host:system": (payload: z.infer<typeof controllerSystemSchema>) => void;
  "host:signal": (payload: SignalPayload) => void;
  "host:play_sound": (payload: PlaySoundEventPayload) => void;
  "controller:play_sound": (payload: PlaySoundEventPayload) => void;
  "host:state_sync": (payload: HostStateSyncPayload) => void;
  "controller:action_rpc": (payload: ControllerActionRpcPayload) => void;
}

export interface PlaySoundPayload {
  id: string;
  volume?: number;
  loop?: boolean;
}

export interface ServerToClientEvents {
  "server:roomReady": (payload: RoomReadyNotice) => void;
  "server:controllerJoined": (payload: ControllerJoinedNotice) => void;
  "server:controllerLeft": (payload: ControllerLeftNotice) => void;
  "server:input": (payload: ControllerInputEvent) => void;
  "server:error": (payload: ServerErrorPayload) => void;
  "server:state": (payload: z.infer<typeof controllerStateSchema>) => void;
  "server:welcome": (payload: ControllerWelcomePayload) => void;
  "server:hostLeft": (payload: HostLeftNotice) => void;
  "server:signal": (payload: SignalPayload) => void;
  "server:playSound": (payload: PlaySoundPayload) => void;
  "server:redirect": (url: string) => void;
  "server:closeChild": () => void;
  "client:loadUi": (payload: ClientLoadUiPayload) => void;
  "client:unloadUi": () => void;
  "airjam:state_sync": (payload: AirJamStateSyncPayload) => void;
  "airjam:action_rpc": (payload: AirJamActionRpcPayload) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export type SocketData = Record<string, unknown>;

// --- Proxy Protocol (iframe <-> parent) ---
// Note: Proxy protocol is largely deprecated in favor of Direct Connect (airjam_force_connect=true),
// but might still be used for UI coordination (e.g. hiding headers).

export const AIRJAM_PROXY_PREFIX = "AIRJAM_";

export interface ProxyMessageBase {
  type: string;
}

export interface ProxyReadyMessage extends ProxyMessageBase {
  type: "AIRJAM_READY";
}

export interface ProxyInputMessage extends ProxyMessageBase {
  type: "AIRJAM_INPUT";
  payload: ControllerInputPayload;
}

export interface ProxyStateMessage extends ProxyMessageBase {
  type: "AIRJAM_STATE";
  payload: ControllerStatePayload;
}

export type AirJamProxyMessage =
  | ProxyReadyMessage
  | ProxyInputMessage
  | ProxyStateMessage;
