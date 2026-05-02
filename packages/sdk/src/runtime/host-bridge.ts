import { z } from "zod";
import { v2HandshakeSchema, type V2Handshake } from "../contracts/v2";
import type {
  AirJamActionRpcPayload,
  AirJamStateSyncRequestPayload,
  ControllerInputEvent,
  ControllerJoinedNotice,
  ControllerLeftNotice,
  ControllerStateMessage,
  ControllerSystemPayload,
  HostLeftNotice,
  HostStateSyncPayload,
  PlaySoundEventPayload,
  PlaySoundPayload,
  RoomCode,
  ServerErrorPayload,
  SignalPayload,
} from "../protocol";
import type { PlayerUpdatedNotice } from "../protocol/notices";
import {
  arcadeSurfaceRuntimeIdentitySchema,
  type ArcadeSurfaceRuntimeIdentity,
} from "./arcade-surface-identity";
import { createBridgeHandshake } from "./iframe-bridge";
import { AIR_JAM_SDK_VERSION } from "./sdk-version";

export const AIRJAM_HOST_BRIDGE_REQUEST = "AIRJAM_HOST_BRIDGE_REQUEST" as const;
export const AIRJAM_HOST_BRIDGE_ATTACH = "AIRJAM_HOST_BRIDGE_ATTACH" as const;
export const AIRJAM_HOST_BRIDGE_EVENT = "AIRJAM_HOST_BRIDGE_EVENT" as const;
export const AIRJAM_HOST_BRIDGE_EMIT = "AIRJAM_HOST_BRIDGE_EMIT" as const;
export const AIRJAM_HOST_BRIDGE_CLOSE = "AIRJAM_HOST_BRIDGE_CLOSE" as const;
export const AIRJAM_HOST_BRIDGE_RESPONSE =
  "AIRJAM_HOST_BRIDGE_RESPONSE" as const;

export const hostBridgeClientEvents = [
  "host:state",
  "host:signal",
  "host:play_sound",
  "host:system",
  "host:state_sync",
] as const;

export const hostBridgeServerEvents = [
  "connect",
  "disconnect",
  "airjam:state_sync_request",
  "server:controllerJoined",
  "server:controllerLeft",
  "server:playerUpdated",
  "server:input",
  "server:error",
  "server:state",
  "server:hostLeft",
  "server:playSound",
  "airjam:action_rpc",
  "server:closeChild",
] as const;

export type HostBridgeClientEventName = (typeof hostBridgeClientEvents)[number];
export type HostBridgeServerEventName = (typeof hostBridgeServerEvents)[number];

export type HostBridgeClientEventArgs = {
  "host:state": [payload: ControllerStateMessage];
  "host:signal": [payload: SignalPayload];
  "host:play_sound": [payload: PlaySoundEventPayload];
  "host:system": [payload: ControllerSystemPayload];
  "host:state_sync": [payload: HostStateSyncPayload];
};

export type HostBridgeServerEventArgs = {
  connect: [];
  disconnect: [reason?: string];
  "airjam:state_sync_request": [payload: AirJamStateSyncRequestPayload];
  "server:controllerJoined": [payload: ControllerJoinedNotice];
  "server:controllerLeft": [payload: ControllerLeftNotice];
  "server:playerUpdated": [payload: PlayerUpdatedNotice];
  "server:input": [payload: ControllerInputEvent];
  "server:error": [payload: ServerErrorPayload];
  "server:state": [payload: ControllerStateMessage];
  "server:hostLeft": [payload: HostLeftNotice];
  "server:playSound": [payload: PlaySoundPayload];
  "airjam:action_rpc": [
    payload: AirJamActionRpcPayload,
    callback?: (ack: unknown) => void,
  ];
  "server:closeChild": [];
};

export interface HostBridgeSnapshot {
  roomId: RoomCode;
  capabilityToken: string;
  connected: boolean;
  socketId?: string;
  players: ControllerJoinedNotice[];
  state?: ControllerStateMessage["state"];
  /** The platform shell's active game surface identity for this embedded host runtime. */
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}

export interface HostBridgeRequestMessage {
  type: typeof AIRJAM_HOST_BRIDGE_REQUEST;
  payload: {
    handshake: V2Handshake;
    roomId: RoomCode;
    capabilityToken: string;
    arcadeSurface: ArcadeSurfaceRuntimeIdentity;
  };
}

export interface HostBridgeAttachMessage {
  type: typeof AIRJAM_HOST_BRIDGE_ATTACH;
  payload: {
    handshake: V2Handshake;
    snapshot: HostBridgeSnapshot;
  };
}

export interface HostBridgeEventMessage {
  type: typeof AIRJAM_HOST_BRIDGE_EVENT;
  payload: {
    event: HostBridgeServerEventName;
    args: unknown[];
    requestId?: string;
  };
}

export interface HostBridgeEmitMessage {
  type: typeof AIRJAM_HOST_BRIDGE_EMIT;
  payload: {
    event: HostBridgeClientEventName;
    args: unknown[];
    requestId?: string;
  };
}

export interface HostBridgeResponseMessage {
  type: typeof AIRJAM_HOST_BRIDGE_RESPONSE;
  payload: {
    requestId: string;
    ack: unknown;
  };
}

export interface HostBridgeCloseMessage {
  type: typeof AIRJAM_HOST_BRIDGE_CLOSE;
  payload: {
    reason?: string;
  };
}

const hostBridgeRequestSchema = z
  .object({
    type: z.literal(AIRJAM_HOST_BRIDGE_REQUEST),
    payload: z
      .object({
        handshake: v2HandshakeSchema,
        roomId: z.string().min(1),
        capabilityToken: z.string().min(1),
        arcadeSurface: arcadeSurfaceRuntimeIdentitySchema,
      })
      .strict(),
  })
  .strict();

const hostBridgeAttachSchema = z
  .object({
    type: z.literal(AIRJAM_HOST_BRIDGE_ATTACH),
    payload: z
      .object({
        handshake: v2HandshakeSchema,
        snapshot: z
          .object({
            roomId: z.string().min(1),
            capabilityToken: z.string().min(1),
            connected: z.boolean(),
            socketId: z.string().optional(),
            players: z.array(z.unknown()),
            state: z.unknown().optional(),
            arcadeSurface: arcadeSurfaceRuntimeIdentitySchema,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const hostBridgeEventSchema = z
  .object({
    type: z.literal(AIRJAM_HOST_BRIDGE_EVENT),
    payload: z
      .object({
        event: z.enum(hostBridgeServerEvents),
        args: z.array(z.unknown()),
        requestId: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

const hostBridgeEmitSchema = z
  .object({
    type: z.literal(AIRJAM_HOST_BRIDGE_EMIT),
    payload: z
      .object({
        event: z.enum(hostBridgeClientEvents),
        args: z.array(z.unknown()),
        requestId: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

const hostBridgeResponseSchema = z
  .object({
    type: z.literal(AIRJAM_HOST_BRIDGE_RESPONSE),
    payload: z
      .object({
        requestId: z.string().min(1),
        ack: z.unknown(),
      })
      .strict(),
  })
  .strict();

const hostBridgeCloseSchema = z
  .object({
    type: z.literal(AIRJAM_HOST_BRIDGE_CLOSE),
    payload: z
      .object({
        reason: z.string().optional(),
      })
      .strict(),
  })
  .strict();

export const createHostBridgeRequestMessage = (payload: {
  roomId: RoomCode;
  capabilityToken: string;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}): HostBridgeRequestMessage => ({
  type: AIRJAM_HOST_BRIDGE_REQUEST,
  payload: {
    handshake: createBridgeHandshake({
      sdkVersion: AIR_JAM_SDK_VERSION,
      runtimeKind: "arcade-host-iframe",
      capabilityFlags: {
        hostBridge: true,
      },
    }),
    roomId: payload.roomId,
    capabilityToken: payload.capabilityToken,
    arcadeSurface: payload.arcadeSurface,
  },
});

export const createHostBridgeAttachMessage = (
  snapshot: HostBridgeSnapshot,
): HostBridgeAttachMessage => ({
  type: AIRJAM_HOST_BRIDGE_ATTACH,
  payload: {
    handshake: createBridgeHandshake({
      sdkVersion: AIR_JAM_SDK_VERSION,
      runtimeKind: "arcade-host-runtime",
      capabilityFlags: {
        hostBridge: true,
      },
    }),
    snapshot,
  },
});

const splitHostBridgeArgs = (
  args: unknown[],
): {
  eventArgs: unknown[];
  requestId?: string;
} => {
  const maybeOptions = args[args.length - 1] as
    | { requestId?: string }
    | undefined;
  const hasOptions =
    typeof maybeOptions === "object" &&
    maybeOptions !== null &&
    "requestId" in maybeOptions;

  return {
    eventArgs: hasOptions ? args.slice(0, -1) : args,
    ...(hasOptions && maybeOptions.requestId
      ? { requestId: maybeOptions.requestId }
      : {}),
  };
};

export const createHostBridgeEventMessage = <
  TEvent extends HostBridgeServerEventName,
>(
  event: TEvent,
  ...args: [...HostBridgeServerEventArgs[TEvent], { requestId?: string }?]
): HostBridgeEventMessage => {
  const { eventArgs, requestId } = splitHostBridgeArgs(args as unknown[]);
  return {
    type: AIRJAM_HOST_BRIDGE_EVENT,
    payload: {
      event,
      args: eventArgs,
      ...(requestId ? { requestId } : {}),
    },
  };
};

export const createHostBridgeEmitMessage = <
  TEvent extends HostBridgeClientEventName,
>(
  event: TEvent,
  ...args: [...HostBridgeClientEventArgs[TEvent], { requestId?: string }?]
): HostBridgeEmitMessage => {
  const { eventArgs, requestId } = splitHostBridgeArgs(args as unknown[]);
  return {
    type: AIRJAM_HOST_BRIDGE_EMIT,
    payload: {
      event,
      args: eventArgs,
      ...(requestId ? { requestId } : {}),
    },
  };
};

export const createHostBridgeResponseMessage = (
  requestId: string,
  ack: unknown,
): HostBridgeResponseMessage => ({
  type: AIRJAM_HOST_BRIDGE_RESPONSE,
  payload: {
    requestId,
    ack,
  },
});

export const createHostBridgeCloseMessage = (
  reason?: string,
): HostBridgeCloseMessage => ({
  type: AIRJAM_HOST_BRIDGE_CLOSE,
  payload: {
    reason,
  },
});

export const parseHostBridgeRequestMessage = (
  value: unknown,
): HostBridgeRequestMessage | null => {
  const result = hostBridgeRequestSchema.safeParse(value);
  return result.success ? (result.data as HostBridgeRequestMessage) : null;
};

export const parseHostBridgeAttachMessage = (
  value: unknown,
): HostBridgeAttachMessage | null => {
  const result = hostBridgeAttachSchema.safeParse(value);
  return result.success ? (result.data as HostBridgeAttachMessage) : null;
};

export const parseHostBridgeEventMessage = (
  value: unknown,
): HostBridgeEventMessage | null => {
  const result = hostBridgeEventSchema.safeParse(value);
  return result.success ? (result.data as HostBridgeEventMessage) : null;
};

export const parseHostBridgeEmitMessage = (
  value: unknown,
): HostBridgeEmitMessage | null => {
  const result = hostBridgeEmitSchema.safeParse(value);
  return result.success ? (result.data as HostBridgeEmitMessage) : null;
};

export const parseHostBridgeResponseMessage = (
  value: unknown,
): HostBridgeResponseMessage | null => {
  const result = hostBridgeResponseSchema.safeParse(value);
  return result.success ? (result.data as HostBridgeResponseMessage) : null;
};

export const parseHostBridgeCloseMessage = (
  value: unknown,
): HostBridgeCloseMessage | null => {
  const result = hostBridgeCloseSchema.safeParse(value);
  return result.success ? (result.data as HostBridgeCloseMessage) : null;
};
