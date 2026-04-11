import type { PlayerProfilePatch, RuntimeState } from "../../protocol";
import type {
  AirJamControllerApi,
} from "../../hooks/use-air-jam-controller";
import type { AirJamHostApi } from "../../hooks/use-air-jam-host";

type HostControlApi = Pick<
  AirJamHostApi,
  "runtimeState" | "toggleRuntimeState" | "sendSignal" | "sendState" | "reconnect"
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
  toggleRuntimeState: () => void;
  setRuntimeState: (state: RuntimeState) => void;
  sendState: HostControlApi["sendState"];
  sendSignal: HostControlApi["sendSignal"];
}

export interface ControllerRuntimeControlContract {
  role: "controller";
  reconnect: () => void;
  sendSystemCommand: ControllerControlApi["sendSystemCommand"];
  setNicknameDraft: (value: string) => void;
  setAvatarIdDraft: (value: string) => void;
  updatePlayerProfile: (patch: PlayerProfilePatch) => ReturnType<ControllerControlApi["updatePlayerProfile"]>;
}

export const createHostRuntimeControlContract = (
  api: HostControlApi,
): HostRuntimeControlContract => ({
  role: "host",
  reconnect: api.reconnect,
  toggleRuntimeState: api.toggleRuntimeState,
  setRuntimeState: (state) => {
    if (api.runtimeState !== state) {
      api.toggleRuntimeState();
    }
  },
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
