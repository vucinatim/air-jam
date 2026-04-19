import type { AirJamControllerApi } from "../../hooks/use-air-jam-controller";
import type {
  AirJamHostApi,
  JoinUrlStatus,
} from "../../hooks/use-air-jam-host";
import type {
  ConnectionStatus,
  ControllerOrientation,
  PlayerProfile,
  RoomCode,
  RunMode,
  RuntimeState,
} from "../../protocol";

type HostInspectionApi = Pick<
  AirJamHostApi,
  | "roomId"
  | "joinUrl"
  | "joinUrlStatus"
  | "connectionStatus"
  | "players"
  | "lastError"
  | "mode"
  | "runtimeState"
>;

type ControllerInspectionApi = Pick<
  AirJamControllerApi,
  | "roomId"
  | "controllerId"
  | "connectionStatus"
  | "lastError"
  | "runtimeState"
  | "controllerOrientation"
  | "stateMessage"
  | "players"
  | "selfPlayer"
>;

export interface HostRuntimeInspectionContract {
  role: "host";
  roomId: RoomCode;
  joinUrl: string;
  joinUrlStatus: JoinUrlStatus;
  connectionStatus: ConnectionStatus;
  players: readonly PlayerProfile[];
  lastError?: string;
  mode: RunMode;
  runtimeState: RuntimeState;
}

export interface ControllerRuntimeInspectionContract {
  role: "controller";
  roomId: RoomCode | null;
  controllerId: string | null;
  connectionStatus: ConnectionStatus;
  players: readonly PlayerProfile[];
  selfPlayer: PlayerProfile | null;
  lastError?: string;
  runtimeState: RuntimeState;
  controllerOrientation: ControllerOrientation;
  stateMessage?: string;
}

export type RuntimeInspectionContract =
  | HostRuntimeInspectionContract
  | ControllerRuntimeInspectionContract;

export const createHostRuntimeInspectionContract = (
  api: HostInspectionApi,
): HostRuntimeInspectionContract => ({
  role: "host",
  roomId: api.roomId,
  joinUrl: api.joinUrl,
  joinUrlStatus: api.joinUrlStatus,
  connectionStatus: api.connectionStatus,
  players: api.players,
  lastError: api.lastError,
  mode: api.mode,
  runtimeState: api.runtimeState,
});

export const createControllerRuntimeInspectionContract = (
  api: ControllerInspectionApi,
): ControllerRuntimeInspectionContract => ({
  role: "controller",
  roomId: api.roomId,
  controllerId: api.controllerId,
  connectionStatus: api.connectionStatus,
  players: api.players,
  selfPlayer: api.selfPlayer,
  lastError: api.lastError,
  runtimeState: api.runtimeState,
  controllerOrientation: api.controllerOrientation,
  stateMessage: api.stateMessage,
});
