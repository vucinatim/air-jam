import type {
  ControllerInputEvent,
  ControllerJoinAck,
  ControllerJoinPayload,
  ControllerLeavePayload,
  ControllerStateMessage,
  ControllerSystemPayload,
} from "./controller";
import type { HostRegistrationAck } from "./host";
import type {
  ClientLoadUiPayload,
  HostCreateRoomPayload,
  HostJoinAsChildPayload,
  HostReconnectPayload,
  HostRegisterSystemPayload,
  SystemLaunchGameAck,
  SystemLaunchGamePayload,
} from "./host";
import type {
  ControllerJoinedNotice,
  ControllerLeftNotice,
  ControllerWelcomePayload,
  HostLeftNotice,
  RoomReadyNotice,
} from "./notices";
import type { ServerErrorPayload } from "./errors";
import type { PlaySoundEventPayload, PlaySoundPayload, SignalPayload } from "./signals";
import type {
  AirJamActionRpcPayload,
  AirJamStateSyncPayload,
  ControllerActionRpcPayload,
  HostStateSyncPayload,
} from "./sync";

export interface ClientToServerEvents {
  "host:registerSystem": (
    payload: HostRegisterSystemPayload,
    callback: (ack: HostRegistrationAck) => void,
  ) => void;
  "host:createRoom": (
    payload: HostCreateRoomPayload,
    callback: (ack: HostRegistrationAck) => void,
  ) => void;
  "host:reconnect": (
    payload: HostReconnectPayload,
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
  "host:state": (payload: ControllerStateMessage) => void;
  "controller:join": (
    payload: ControllerJoinPayload,
    callback: (ack: ControllerJoinAck) => void,
  ) => void;
  "controller:leave": (payload: ControllerLeavePayload) => void;
  "controller:input": (payload: ControllerInputEvent) => void;
  "controller:system": (payload: ControllerSystemPayload) => void;
  "host:system": (payload: ControllerSystemPayload) => void;
  "host:signal": (payload: SignalPayload) => void;
  "host:play_sound": (payload: PlaySoundEventPayload) => void;
  "controller:play_sound": (payload: PlaySoundEventPayload) => void;
  "host:state_sync": (payload: HostStateSyncPayload) => void;
  "controller:action_rpc": (payload: ControllerActionRpcPayload) => void;
}

export interface ServerToClientEvents {
  "server:roomReady": (payload: RoomReadyNotice) => void;
  "server:controllerJoined": (payload: ControllerJoinedNotice) => void;
  "server:controllerLeft": (payload: ControllerLeftNotice) => void;
  "server:input": (payload: ControllerInputEvent) => void;
  "server:error": (payload: ServerErrorPayload) => void;
  "server:state": (payload: ControllerStateMessage) => void;
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
