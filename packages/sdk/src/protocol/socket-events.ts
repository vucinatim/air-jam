import { z } from "zod";
import type {
  ControllerInputEvent,
  ControllerJoinAck,
  ControllerJoinPayload,
  ControllerLeaveAck,
  ControllerLeavePayload,
  ControllerSocketAuthority,
  ControllerStateMessage,
  ControllerSystemPayload,
  ControllerUpdatePlayerProfileAck,
  ControllerUpdatePlayerProfilePayload,
} from "./controller";
import {
  controllerInputSchema,
  controllerJoinSchema,
  controllerLeaveSchema,
  controllerStateSchema,
  controllerSystemSchema,
  controllerUpdatePlayerProfileSchema,
} from "./controller";
import type { ServerErrorPayload } from "./errors";
import type {
  HostActivateEmbeddedGamePayload,
  HostBootstrapAck,
  HostBootstrapPayload,
  HostControllerActionAck,
  HostCreateRoomPayload,
  HostJoinAsChildPayload,
  HostReconnectPayload,
  HostRegistrationAck,
  HostRemoveControllerPayload,
  HostResetRoomPayload,
  HostSocketAuthority,
  SystemLaunchGameAck,
  SystemLaunchGamePayload,
} from "./host";
import {
  hostActivateEmbeddedGameSchema,
  hostBootstrapSchema,
  hostCreateRoomSchema,
  hostJoinAsChildSchema,
  hostReconnectSchema,
  hostRemoveControllerSchema,
  hostResetRoomSchema,
  systemCloseGameSchema,
  systemLaunchGameSchema,
} from "./host";
import type {
  ControllerLeasedControl,
  ControllerLeasedControlAck,
} from "./leased-control";
import { controllerLeasedControlSchema } from "./leased-control";
import type {
  ControllerJoinedNotice,
  ControllerLeftNotice,
  ControllerPresenceNotice,
  ControllerWelcomePayload,
  HostLeftNotice,
  PlayerUpdatedNotice,
  RoomReadyNotice,
} from "./notices";
import type {
  RuntimeErrorReport,
  RuntimeErrorReportAck,
} from "./runtime-reporting";
import { runtimeErrorReportSchema } from "./runtime-reporting";
import type {
  PlaySoundEventPayload,
  PlaySoundPayload,
  SignalPayload,
} from "./signals";
import { playSoundEventSchema, signalSchema } from "./signals";
import type { SocketPayloadLane } from "./socket-payload";
import type {
  AirJamActionInvocationResult,
  AirJamActionRpcPayload,
  AirJamPrivateStateSyncPayload,
  AirJamStateSyncPayload,
  AirJamStateSyncRequestPayload,
  ControllerActionRpcPayload,
  ControllerStateSyncRequestPayload,
  HostPrivateStateSyncPayload,
  HostStateSyncPayload,
} from "./sync";
import {
  controllerActionRpcSchema,
  controllerStateSyncRequestSchema,
  hostPrivateStateSyncSchema,
  hostStateSyncSchema,
} from "./sync";

export interface ClientToServerEvents {
  "runtime:error_report": (
    payload: RuntimeErrorReport,
    callback: (ack: RuntimeErrorReportAck) => void,
  ) => void;
  "host:bootstrap": (
    payload: HostBootstrapPayload,
    callback: (ack: HostBootstrapAck) => void,
  ) => void;
  "host:createRoom": (
    payload: HostCreateRoomPayload,
    callback: (ack: HostRegistrationAck) => void,
  ) => void;
  "host:reconnect": (
    payload: HostReconnectPayload,
    callback: (ack: HostRegistrationAck) => void,
  ) => void;
  "host:resetRoom": (
    payload: HostResetRoomPayload,
    callback: (ack: HostRegistrationAck) => void,
  ) => void;
  "host:removeController": (
    payload: HostRemoveControllerPayload,
    callback: (ack: HostControllerActionAck) => void,
  ) => void;
  "system:launchGame": (
    payload: SystemLaunchGamePayload,
    callback: (ack: SystemLaunchGameAck) => void,
  ) => void;
  "host:joinAsChild": (
    payload: HostJoinAsChildPayload,
    callback: (ack: HostRegistrationAck) => void,
  ) => void;
  "host:activateEmbeddedGame": (
    payload: HostActivateEmbeddedGamePayload,
    callback: (ack: HostRegistrationAck) => void,
  ) => void;
  "system:closeGame": (payload: { roomId: string }) => void;
  "host:state": (payload: ControllerStateMessage) => void;
  "controller:join": (
    payload: ControllerJoinPayload,
    callback: (ack: ControllerJoinAck) => void,
  ) => void;
  "controller:updatePlayerProfile": (
    payload: ControllerUpdatePlayerProfilePayload,
    callback: (ack: ControllerUpdatePlayerProfileAck) => void,
  ) => void;
  "controller:leave": (
    payload: ControllerLeavePayload,
    callback: (ack: ControllerLeaveAck) => void,
  ) => void;
  "controller:input": (payload: ControllerInputEvent) => void;
  "controller:leasedControl": (
    payload: ControllerLeasedControl,
    callback: (ack: ControllerLeasedControlAck) => void,
  ) => void;
  "controller:system": (payload: ControllerSystemPayload) => void;
  "host:system": (payload: ControllerSystemPayload) => void;
  "host:signal": (payload: SignalPayload) => void;
  "host:play_sound": (payload: PlaySoundEventPayload) => void;
  "controller:play_sound": (payload: PlaySoundEventPayload) => void;
  "host:private_state_sync": (payload: HostPrivateStateSyncPayload) => void;
  "host:state_sync": (payload: HostStateSyncPayload) => void;
  "controller:action_rpc": (
    payload: ControllerActionRpcPayload,
    callback?: (ack: AirJamActionInvocationResult) => void,
  ) => void;
  "controller:state_sync_request": (
    payload: ControllerStateSyncRequestPayload,
  ) => void;
}

export interface ServerToClientEvents {
  "server:roomReady": (payload: RoomReadyNotice) => void;
  "server:controllerJoined": (payload: ControllerJoinedNotice) => void;
  "server:controllerLeft": (payload: ControllerLeftNotice) => void;
  "server:controllerDisconnected": (payload: ControllerPresenceNotice) => void;
  "server:playerUpdated": (payload: PlayerUpdatedNotice) => void;
  "server:input": (payload: ControllerInputEvent) => void;
  "server:leasedControl": (
    payload: ControllerLeasedControl,
    callback: (ack: ControllerLeasedControlAck) => void,
  ) => void;
  "server:error": (payload: ServerErrorPayload) => void;
  "server:state": (payload: ControllerStateMessage) => void;
  "server:welcome": (payload: ControllerWelcomePayload) => void;
  "server:hostLeft": (payload: HostLeftNotice) => void;
  "server:signal": (payload: SignalPayload) => void;
  "server:playSound": (payload: PlaySoundPayload) => void;
  "server:redirect": (url: string) => void;
  "server:closeChild": () => void;
  "airjam:private_state_sync": (payload: AirJamPrivateStateSyncPayload) => void;
  "airjam:state_sync": (payload: AirJamStateSyncPayload) => void;
  "airjam:action_rpc": (
    payload: AirJamActionRpcPayload,
    callback?: (ack: AirJamActionInvocationResult) => void,
  ) => void;
  "airjam:state_sync_request": (payload: AirJamStateSyncRequestPayload) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  hostAuthority?: HostSocketAuthority;
  controllerAuthority?: ControllerSocketAuthority;
}

export const clientSocketEvents = {
  "runtime:error_report": {
    schema: runtimeErrorReportSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "host:bootstrap": {
    schema: hostBootstrapSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "host:createRoom": {
    schema: hostCreateRoomSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "host:reconnect": {
    schema: hostReconnectSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "host:resetRoom": {
    schema: hostResetRoomSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "host:removeController": {
    schema: hostRemoveControllerSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "system:launchGame": {
    schema: systemLaunchGameSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "host:joinAsChild": {
    schema: hostJoinAsChildSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "host:activateEmbeddedGame": {
    schema: hostActivateEmbeddedGameSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "system:closeGame": {
    schema: systemCloseGameSchema,
    lane: "lifecycle",
    acknowledgement: "none",
  },
  "host:state": {
    schema: controllerStateSchema,
    lane: "hostState",
    acknowledgement: "none",
  },
  "controller:join": {
    schema: controllerJoinSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "controller:updatePlayerProfile": {
    schema: controllerUpdatePlayerProfileSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "controller:leave": {
    schema: controllerLeaveSchema,
    lane: "lifecycle",
    acknowledgement: "required",
  },
  "controller:input": {
    schema: controllerInputSchema,
    lane: "controller",
    acknowledgement: "none",
  },
  "controller:leasedControl": {
    schema: controllerLeasedControlSchema,
    lane: "controller",
    acknowledgement: "required",
  },
  "controller:system": {
    schema: controllerSystemSchema,
    lane: "lifecycle",
    acknowledgement: "none",
  },
  "host:system": {
    schema: controllerSystemSchema,
    lane: "lifecycle",
    acknowledgement: "none",
  },
  "host:signal": {
    schema: signalSchema,
    lane: "hostState",
    acknowledgement: "none",
  },
  "host:play_sound": {
    schema: playSoundEventSchema,
    lane: "controller",
    acknowledgement: "none",
  },
  "controller:play_sound": {
    schema: playSoundEventSchema,
    lane: "controller",
    acknowledgement: "none",
  },
  "host:private_state_sync": {
    schema: hostPrivateStateSyncSchema,
    lane: "hostState",
    acknowledgement: "none",
  },
  "host:state_sync": {
    schema: hostStateSyncSchema,
    lane: "hostState",
    acknowledgement: "none",
  },
  "controller:action_rpc": {
    schema: controllerActionRpcSchema,
    lane: "controller",
    acknowledgement: "optional",
  },
  "controller:state_sync_request": {
    schema: controllerStateSyncRequestSchema,
    lane: "controller",
    acknowledgement: "none",
  },
} as const satisfies {
  [Event in keyof ClientToServerEvents]: {
    schema: z.ZodType<Parameters<ClientToServerEvents[Event]>[0]>;
    lane: SocketPayloadLane;
    acknowledgement: "required" | "optional" | "none";
  };
};
