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
import type { ServerErrorPayload } from "./errors";
import type {
  HostActivateEmbeddedGamePayload,
  HostBootstrapAck,
  HostControllerActionAck,
  HostBootstrapPayload,
  HostCreateRoomPayload,
  HostJoinAsChildPayload,
  HostRemoveControllerPayload,
  HostReconnectPayload,
  HostResetRoomPayload,
  HostRegisterSystemPayload,
  HostRegistrationAck,
  HostSocketAuthority,
  SystemLaunchGameAck,
  SystemLaunchGamePayload,
} from "./host";
import type {
  ControllerJoinedNotice,
  ControllerLeftNotice,
  ControllerWelcomePayload,
  HostLeftNotice,
  PlayerUpdatedNotice,
  RoomReadyNotice,
} from "./notices";
import type {
  PlaySoundEventPayload,
  PlaySoundPayload,
  SignalPayload,
} from "./signals";
import type {
  AirJamActionInvocationResult,
  AirJamActionRpcPayload,
  AirJamStateSyncPayload,
  AirJamStateSyncRequestPayload,
  ControllerActionRpcPayload,
  HostActionRpcPayload,
  ControllerStateSyncRequestPayload,
  HostStateSyncPayload,
} from "./sync";

export interface ClientToServerEvents {
  "host:bootstrap": (
    payload: HostBootstrapPayload,
    callback: (ack: HostBootstrapAck) => void,
  ) => void;
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
  "controller:system": (payload: ControllerSystemPayload) => void;
  "host:system": (payload: ControllerSystemPayload) => void;
  "host:signal": (payload: SignalPayload) => void;
  "host:play_sound": (payload: PlaySoundEventPayload) => void;
  "controller:play_sound": (payload: PlaySoundEventPayload) => void;
  "host:state_sync": (payload: HostStateSyncPayload) => void;
  "controller:action_rpc": (
    payload: ControllerActionRpcPayload,
    callback?: (ack: AirJamActionInvocationResult) => void,
  ) => void;
  "controller:host_action_rpc": (
    payload: HostActionRpcPayload,
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
  "server:playerUpdated": (payload: PlayerUpdatedNotice) => void;
  "server:input": (payload: ControllerInputEvent) => void;
  "server:error": (payload: ServerErrorPayload) => void;
  "server:state": (payload: ControllerStateMessage) => void;
  "server:welcome": (payload: ControllerWelcomePayload) => void;
  "server:hostLeft": (payload: HostLeftNotice) => void;
  "server:signal": (payload: SignalPayload) => void;
  "server:playSound": (payload: PlaySoundPayload) => void;
  "server:redirect": (url: string) => void;
  "server:closeChild": () => void;
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
