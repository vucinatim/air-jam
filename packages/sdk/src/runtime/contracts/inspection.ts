import type { AirJamControllerApi } from "../../hooks/use-air-jam-controller";
import type {
  AirJamHostApi,
  JoinUrlStatus,
} from "../../hooks/use-air-jam-host";
import type {
  ConnectionStatus,
  ControllerOrientation,
  ControllerPresenceNotice,
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
  | "controllers"
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
  | "roomSettings"
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
  controllers: readonly ControllerPresenceNotice[];
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
  roomSettings: ControllerInspectionApi["roomSettings"];
}

export type RuntimeInspectionContract =
  | HostRuntimeInspectionContract
  | ControllerRuntimeInspectionContract;

export const AIR_JAM_RUNTIME_INSPECTION_KEY = "__airJamRuntimeInspection";

export const createHostRuntimeInspectionContract = (
  api: HostInspectionApi,
): HostRuntimeInspectionContract => ({
  role: "host",
  roomId: api.roomId,
  joinUrl: api.joinUrl,
  joinUrlStatus: api.joinUrlStatus,
  connectionStatus: api.connectionStatus,
  players: api.players,
  controllers: api.controllers,
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
  roomSettings: api.roomSettings,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isHostRuntimeInspectionContract = (
  value: unknown,
): value is HostRuntimeInspectionContract =>
  isRecord(value) &&
  value.role === "host" &&
  typeof value.roomId === "string" &&
  typeof value.joinUrl === "string" &&
  typeof value.joinUrlStatus === "string" &&
  typeof value.connectionStatus === "string" &&
  Array.isArray(value.players) &&
  Array.isArray(value.controllers) &&
  typeof value.mode === "string" &&
  typeof value.runtimeState === "string";

const isControllerRuntimeInspectionContract = (
  value: unknown,
): value is ControllerRuntimeInspectionContract =>
  isRecord(value) &&
  value.role === "controller" &&
  (typeof value.roomId === "string" || value.roomId === null) &&
  (typeof value.controllerId === "string" || value.controllerId === null) &&
  typeof value.connectionStatus === "string" &&
  Array.isArray(value.players) &&
  typeof value.runtimeState === "string" &&
  typeof value.controllerOrientation === "string" &&
  isRecord(value.roomSettings) &&
  isRecord(value.roomSettings.audio) &&
  isRecord(value.roomSettings.previewControllers);

export const readRuntimeInspectionContract = (
  target: object,
): RuntimeInspectionContract | null => {
  const candidate = (target as Record<string, unknown>)[
    AIR_JAM_RUNTIME_INSPECTION_KEY
  ];
  if (isHostRuntimeInspectionContract(candidate)) {
    return candidate;
  }
  if (isControllerRuntimeInspectionContract(candidate)) {
    return candidate;
  }
  return null;
};

export const publishRuntimeInspectionContract = (
  target: object,
  contract: RuntimeInspectionContract | null,
): void => {
  const hostTarget = target as Record<string, unknown>;
  if (contract) {
    hostTarget[AIR_JAM_RUNTIME_INSPECTION_KEY] = contract;
    return;
  }

  delete hostTarget[AIR_JAM_RUNTIME_INSPECTION_KEY];
};
