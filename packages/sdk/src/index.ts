export {
  ControllerSessionProvider,
  HostSessionProvider,
  type AirJamProviderProps,
} from "./context/session-providers";

export {
  AudioManager,
  type PlayOptions,
  type SoundCategory,
  type SoundConfig,
  type SoundManifest,
} from "./audio/audio-manager";
export {
  useAudio,
  useRemoteSound,
  type UseRemoteSoundOptions,
} from "./audio/hooks";
export { useVolumeStore } from "./audio/volume-store";

export {
  onAirJamDiagnostic,
  setAirJamDiagnosticsEnabled,
  type AirJamDiagnostic,
  type AirJamDiagnosticCode,
  type AirJamDiagnosticSeverity,
} from "./diagnostics";

export {
  useAirJamController,
  type AirJamControllerApi,
  type AirJamControllerOptions,
} from "./hooks/use-air-jam-controller";
export {
  useAirJamHost,
  type AirJamHostApi,
  type AirJamHostOptions,
  type JoinUrlStatus,
} from "./hooks/use-air-jam-host";
export { useConnectionStatus } from "./hooks/use-connection-status";
export {
  useControllerSession,
  type AirJamControllerSessionState,
} from "./hooks/use-controller-session";
export {
  useControllerTick,
  type ControllerTickInfo,
  type ControllerTickOptions,
} from "./hooks/use-controller-tick";
export {
  useControllerToasts,
  type ControllerToast,
  type UseControllerToastsOptions,
} from "./hooks/use-controller-toasts";
export { useGetInput } from "./hooks/use-get-input";
export {
  useHostGameStateBridge,
  type UseHostGameStateBridgeOptions,
} from "./hooks/use-host-game-state-bridge";
export {
  useHostSession,
  type AirJamHostSessionState,
} from "./hooks/use-host-session";
export {
  useHostTick,
  type HostTickInfo,
  type HostTickOptions,
} from "./hooks/use-host-tick";
export { useInputWriter } from "./hooks/use-input-writer";
export { usePlayers } from "./hooks/use-players";
export { useRoom, type RoomState } from "./hooks/use-room";
export { useSendSignal, type SendSignalFn } from "./hooks/use-send-signal";

export type {
  ConnectionStatus,
  GameState,
  RoomCode,
  RunMode,
} from "./protocol/core";
export type {
  ControllerOrientation,
  ControllerStatePayload,
  ControllerUpdatePlayerProfileAck,
  PlayerProfile,
  PlayerProfilePatch,
} from "./protocol/controller";
export type {
  HapticSignalPayload,
  SignalPayload,
  SignalType,
  ToastSignalPayload,
} from "./protocol/signals";

export {
  createAirJamApp,
  env,
  type AirJamApp,
  type AirJamGameMetadata,
  type CreateAirJamAppOptions,
} from "./runtime/create-air-jam-app";

export {
  createAirJamStore,
  type AirJamActionContext,
  type AirJamSyncedStoreHook,
  type CreateAirJamStoreOptions,
} from "./store/create-air-jam-store";

export type {
  DocumentWithFullscreen,
  ElementWithFullscreen,
} from "./types/browser";
