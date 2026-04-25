import type { AirJamControllerApi } from "../../hooks/use-air-jam-controller";
import type { AirJamHostApi } from "../../hooks/use-air-jam-host";
import type { PlayerProfilePatch, RuntimeState } from "../../protocol";

type HostControlApi = Pick<
  AirJamHostApi,
  | "runtimeState"
  | "pauseRuntime"
  | "resumeRuntime"
  | "setRuntimeState"
  | "sendSignal"
  | "sendState"
  | "reconnect"
>;

type ControllerControlApi = Pick<
  AirJamControllerApi,
  | "runtimeState"
  | "sendSystemCommand"
  | "setNickname"
  | "setAvatarId"
  | "updatePlayerProfile"
  | "reconnect"
>;

export interface HostRuntimeControlContract {
  role: "host";
  reconnect: () => void;
  setRuntimeState: (state: RuntimeState) => void;
  pauseRuntime: () => void;
  resumeRuntime: () => void;
  sendState: HostControlApi["sendState"];
  sendSignal: HostControlApi["sendSignal"];
}

export interface ControllerRuntimeControlContract {
  role: "controller";
  reconnect: () => void;
  sendSystemCommand: ControllerControlApi["sendSystemCommand"];
  setNicknameDraft: (value: string) => void;
  setAvatarIdDraft: (value: string) => void;
  updatePlayerProfile: (
    patch: PlayerProfilePatch,
  ) => ReturnType<ControllerControlApi["updatePlayerProfile"]>;
}

export const createHostRuntimeControlContract = (
  api: HostControlApi,
): HostRuntimeControlContract => ({
  role: "host",
  reconnect: api.reconnect,
  setRuntimeState: api.setRuntimeState,
  pauseRuntime: api.pauseRuntime,
  resumeRuntime: api.resumeRuntime,
  sendState: api.sendState,
  sendSignal: api.sendSignal,
});

export const createControllerRuntimeControlContract = (
  api: ControllerControlApi,
): ControllerRuntimeControlContract => ({
  role: "controller",
  reconnect: api.reconnect,
  sendSystemCommand: api.sendSystemCommand,
  setNicknameDraft: api.setNickname,
  setAvatarIdDraft: api.setAvatarId,
  updatePlayerProfile: api.updatePlayerProfile,
});
