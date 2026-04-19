import { z } from "zod";
import { v2HandshakeSchema, type V2Handshake } from "../contracts/v2";
import {
  controllerOrientationSchema,
  type AirJamStateSyncPayload,
  type AirJamStateSyncRequestPayload,
  type ControllerActionRpcPayload,
  type ControllerInputEvent,
  type ControllerJoinedNotice,
  type ControllerLeftNotice,
  type ControllerOrientation,
  type ControllerStateMessage,
  type ControllerSystemPayload,
  type ControllerUpdatePlayerProfilePayload,
  type ControllerWelcomePayload,
  type HostLeftNotice,
  type PlaySoundEventPayload,
  type PlaySoundPayload,
  type PlayerProfile,
  type PlayerUpdatedNotice,
  type RoomCode,
  type ServerErrorPayload,
  type SignalPayload,
} from "../protocol";
import {
  arcadeSurfaceRuntimeIdentitySchema,
  type ArcadeSurfaceRuntimeIdentity,
} from "./arcade-surface-identity";
import { createBridgeHandshake } from "./iframe-bridge";
import { AIR_JAM_SDK_VERSION } from "./sdk-version";

export const AIRJAM_CONTROLLER_BRIDGE_REQUEST =
  "AIRJAM_CONTROLLER_BRIDGE_REQUEST" as const;
export const AIRJAM_CONTROLLER_BRIDGE_ATTACH =
  "AIRJAM_CONTROLLER_BRIDGE_ATTACH" as const;
export const AIRJAM_CONTROLLER_BRIDGE_EVENT =
  "AIRJAM_CONTROLLER_BRIDGE_EVENT" as const;
export const AIRJAM_CONTROLLER_BRIDGE_EMIT =
  "AIRJAM_CONTROLLER_BRIDGE_EMIT" as const;
export const AIRJAM_CONTROLLER_BRIDGE_CLOSE =
  "AIRJAM_CONTROLLER_BRIDGE_CLOSE" as const;
export const AIRJAM_CONTROLLER_PRESENTATION_SYNC =
  "AIRJAM_CONTROLLER_PRESENTATION_SYNC" as const;

export const controllerBridgeClientEvents = [
  "controller:input",
  "controller:action_rpc",
  "controller:state_sync_request",
  "controller:system",
  "controller:play_sound",
  "controller:updatePlayerProfile",
] as const;

export const controllerBridgeServerEvents = [
  "connect",
  "disconnect",
  "server:welcome",
  "server:controllerJoined",
  "server:controllerLeft",
  "server:state",
  "server:hostLeft",
  "server:error",
  "server:signal",
  "server:playSound",
  "server:playerUpdated",
  "airjam:state_sync",
] as const;

export type ControllerBridgeClientEventName =
  (typeof controllerBridgeClientEvents)[number];
export type ControllerBridgeServerEventName =
  (typeof controllerBridgeServerEvents)[number];

export type ControllerBridgeClientEventArgs = {
  "controller:input": [payload: ControllerInputEvent];
  "controller:action_rpc": [payload: ControllerActionRpcPayload];
  "controller:state_sync_request": [payload: AirJamStateSyncRequestPayload];
  "controller:system": [payload: ControllerSystemPayload];
  "controller:play_sound": [payload: PlaySoundEventPayload];
  "controller:updatePlayerProfile": [
    payload: ControllerUpdatePlayerProfilePayload,
  ];
};

export type ControllerBridgeServerEventArgs = {
  connect: [];
  disconnect: [reason?: string];
  "server:welcome": [payload: ControllerWelcomePayload];
  "server:controllerJoined": [payload: ControllerJoinedNotice];
  "server:controllerLeft": [payload: ControllerLeftNotice];
  "server:state": [payload: ControllerStateMessage];
  "server:hostLeft": [payload: HostLeftNotice];
  "server:error": [payload: ServerErrorPayload];
  "server:signal": [payload: SignalPayload];
  "server:playSound": [payload: PlaySoundPayload];
  "server:playerUpdated": [payload: PlayerUpdatedNotice];
  "airjam:state_sync": [payload: AirJamStateSyncPayload];
};

export interface ControllerBridgeSnapshot {
  roomId: RoomCode;
  controllerId: string;
  connected: boolean;
  socketId?: string;
  player?: PlayerProfile;
  players?: PlayerProfile[];
  state?: ControllerStateMessage["state"];
  /** The platform shell's active game surface identity for this embedded controller runtime. */
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}

export interface ControllerBridgeRequestMessage {
  type: typeof AIRJAM_CONTROLLER_BRIDGE_REQUEST;
  payload: {
    handshake: V2Handshake;
    roomId: RoomCode;
    controllerId: string;
    arcadeSurface: ArcadeSurfaceRuntimeIdentity;
  };
}

export interface ControllerBridgeAttachMessage {
  type: typeof AIRJAM_CONTROLLER_BRIDGE_ATTACH;
  payload: {
    handshake: V2Handshake;
    snapshot: ControllerBridgeSnapshot;
  };
}

export interface ControllerBridgeEventMessage {
  type: typeof AIRJAM_CONTROLLER_BRIDGE_EVENT;
  payload: {
    event: ControllerBridgeServerEventName;
    args: unknown[];
  };
}

export interface ControllerBridgeEmitMessage {
  type: typeof AIRJAM_CONTROLLER_BRIDGE_EMIT;
  payload: {
    event: ControllerBridgeClientEventName;
    args: unknown[];
  };
}

export interface ControllerBridgeCloseMessage {
  type: typeof AIRJAM_CONTROLLER_BRIDGE_CLOSE;
  payload: {
    reason?: string;
  };
}

export interface ControllerPresentationSyncMessage {
  type: typeof AIRJAM_CONTROLLER_PRESENTATION_SYNC;
  payload: {
    orientation: ControllerOrientation;
    arcadeSurface: ArcadeSurfaceRuntimeIdentity;
  };
}

export type ControllerBridgePortMessage =
  | ControllerBridgeAttachMessage
  | ControllerBridgeEventMessage
  | ControllerBridgeEmitMessage
  | ControllerBridgeCloseMessage;

const bridgeRequestSchema = z
  .object({
    type: z.literal(AIRJAM_CONTROLLER_BRIDGE_REQUEST),
    payload: z
      .object({
        handshake: v2HandshakeSchema,
        roomId: z.string().min(1),
        controllerId: z.string().min(1),
        arcadeSurface: arcadeSurfaceRuntimeIdentitySchema,
      })
      .strict(),
  })
  .strict();

const bridgeAttachSchema = z
  .object({
    type: z.literal(AIRJAM_CONTROLLER_BRIDGE_ATTACH),
    payload: z
      .object({
        handshake: v2HandshakeSchema,
        snapshot: z
          .object({
            roomId: z.string().min(1),
            controllerId: z.string().min(1),
            connected: z.boolean(),
            socketId: z.string().optional(),
            player: z.unknown().optional(),
            players: z.array(z.unknown()).optional(),
            state: z.unknown().optional(),
            arcadeSurface: arcadeSurfaceRuntimeIdentitySchema,
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const bridgeEventSchema = z
  .object({
    type: z.literal(AIRJAM_CONTROLLER_BRIDGE_EVENT),
    payload: z
      .object({
        event: z.enum(controllerBridgeServerEvents),
        args: z.array(z.unknown()),
      })
      .strict(),
  })
  .strict();

const bridgeEmitSchema = z
  .object({
    type: z.literal(AIRJAM_CONTROLLER_BRIDGE_EMIT),
    payload: z
      .object({
        event: z.enum(controllerBridgeClientEvents),
        args: z.array(z.unknown()),
      })
      .strict(),
  })
  .strict();

const bridgeCloseSchema = z
  .object({
    type: z.literal(AIRJAM_CONTROLLER_BRIDGE_CLOSE),
    payload: z
      .object({
        reason: z.string().optional(),
      })
      .strict(),
  })
  .strict();

const presentationSyncSchema = z
  .object({
    type: z.literal(AIRJAM_CONTROLLER_PRESENTATION_SYNC),
    payload: z
      .object({
        orientation: controllerOrientationSchema,
        arcadeSurface: arcadeSurfaceRuntimeIdentitySchema,
      })
      .strict(),
  })
  .strict();

export const createControllerBridgeRequestMessage = (payload: {
  roomId: RoomCode;
  controllerId: string;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}): ControllerBridgeRequestMessage => ({
  type: AIRJAM_CONTROLLER_BRIDGE_REQUEST,
  payload: {
    handshake: createBridgeHandshake({
      sdkVersion: AIR_JAM_SDK_VERSION,
      runtimeKind: "arcade-controller-iframe",
      capabilityFlags: {
        controllerBridge: true,
      },
    }),
    roomId: payload.roomId,
    controllerId: payload.controllerId,
    arcadeSurface: payload.arcadeSurface,
  },
});

export const createControllerBridgeAttachMessage = (
  snapshot: ControllerBridgeSnapshot,
): ControllerBridgeAttachMessage => ({
  type: AIRJAM_CONTROLLER_BRIDGE_ATTACH,
  payload: {
    handshake: createBridgeHandshake({
      sdkVersion: AIR_JAM_SDK_VERSION,
      runtimeKind: "arcade-controller-runtime",
      capabilityFlags: {
        controllerBridge: true,
      },
    }),
    snapshot,
  },
});

export const createControllerBridgeEventMessage = <
  TEvent extends ControllerBridgeServerEventName,
>(
  event: TEvent,
  ...args: ControllerBridgeServerEventArgs[TEvent]
): ControllerBridgeEventMessage => ({
  type: AIRJAM_CONTROLLER_BRIDGE_EVENT,
  payload: {
    event,
    args,
  },
});

export const createControllerBridgeEmitMessage = <
  TEvent extends ControllerBridgeClientEventName,
>(
  event: TEvent,
  ...args: ControllerBridgeClientEventArgs[TEvent]
): ControllerBridgeEmitMessage => ({
  type: AIRJAM_CONTROLLER_BRIDGE_EMIT,
  payload: {
    event,
    args,
  },
});

export const createControllerBridgeCloseMessage = (
  reason?: string,
): ControllerBridgeCloseMessage => ({
  type: AIRJAM_CONTROLLER_BRIDGE_CLOSE,
  payload: {
    reason,
  },
});

export const createControllerPresentationSyncMessage = (payload: {
  orientation: ControllerOrientation;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}): ControllerPresentationSyncMessage => ({
  type: AIRJAM_CONTROLLER_PRESENTATION_SYNC,
  payload,
});

export const parseControllerBridgeRequestMessage = (
  value: unknown,
): ControllerBridgeRequestMessage | null => {
  const result = bridgeRequestSchema.safeParse(value);
  return result.success
    ? (result.data as ControllerBridgeRequestMessage)
    : null;
};

export const parseControllerBridgeAttachMessage = (
  value: unknown,
): ControllerBridgeAttachMessage | null => {
  const result = bridgeAttachSchema.safeParse(value);
  return result.success ? (result.data as ControllerBridgeAttachMessage) : null;
};

export const parseControllerBridgeEventMessage = (
  value: unknown,
): ControllerBridgeEventMessage | null => {
  const result = bridgeEventSchema.safeParse(value);
  return result.success ? (result.data as ControllerBridgeEventMessage) : null;
};

export const parseControllerBridgeEmitMessage = (
  value: unknown,
): ControllerBridgeEmitMessage | null => {
  const result = bridgeEmitSchema.safeParse(value);
  return result.success ? (result.data as ControllerBridgeEmitMessage) : null;
};

export const parseControllerBridgeCloseMessage = (
  value: unknown,
): ControllerBridgeCloseMessage | null => {
  const result = bridgeCloseSchema.safeParse(value);
  return result.success ? (result.data as ControllerBridgeCloseMessage) : null;
};

export const parseControllerPresentationSyncMessage = (
  value: unknown,
): ControllerPresentationSyncMessage | null => {
  const result = presentationSyncSchema.safeParse(value);
  return result.success
    ? (result.data as ControllerPresentationSyncMessage)
    : null;
};
