export type {
  AudioHandle,
  PlayOptions,
  SoundCategory,
  SoundConfig,
  SoundManifest,
} from "./audio/audio-manager";
export {
  AudioRuntime,
  useAudio,
  useAudioRuntimeControls,
  useAudioRuntimeStatus,
  type AudioRuntimeControls,
  type AudioRuntimeProps,
  type AudioRuntimeStatus,
} from "./audio/hooks";
export {
  MusicPlaylist,
  useAudioCategoryVolume,
  useMusicVolume,
  type AudioVolumeCategory,
  type MusicPlaylistProps,
} from "./audio/music";
export {
  DEFAULT_PLATFORM_SETTINGS,
  getEffectiveAudioVolume,
} from "./settings/platform-settings";
export type {
  PlatformAccessibilitySettings,
  PlatformAudioSettings,
  PlatformFeedbackSettings,
  PlatformSettings,
  PlatformSettingsPersistence,
  PlatformSettingsSnapshot,
} from "./settings/platform-settings";
export {
  PlatformSettingsBoundary,
  PlatformSettingsRuntime,
  useInheritedPlatformSettings,
  usePlatformAudioSettings,
  usePlatformSettings,
  type PlatformAudioSettingsApi,
  type PlatformSettingsBoundaryProps,
  type PlatformSettingsOwnerApi,
  type PlatformSettingsRuntimeProps,
} from "./settings/platform-settings-runtime";

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
  type AirJamControllerState,
} from "./hooks/use-air-jam-controller";
export {
  useAirJamHost,
  type AirJamHostApi,
  type AirJamHostOptions,
  type AirJamHostState,
  type JoinUrlStatus,
} from "./hooks/use-air-jam-host";
export { useConnectionStatus } from "./hooks/use-connection-status";
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
  useHostTick,
  type HostFrameInfo,
  type HostTickInfo,
  type HostTickOptions,
} from "./hooks/use-host-tick";
export { useInputWriter } from "./hooks/use-input-writer";
export { usePlayers } from "./hooks/use-players";
export { useRoom, type RoomState } from "./hooks/use-room";
export { useSendSignal, type SendSignalFn } from "./hooks/use-send-signal";
export {
  AirJamControllerRuntime,
  AirJamHostRuntime,
  type AirJamControllerRuntimeProps,
  type AirJamHostRuntimeProps,
} from "./runtime/session-runtimes";

export {
  isActiveMatchPhase,
  isEndedMatchPhase,
  isStandardMatchPhase,
  standardMatchPhases,
  toShellMatchPhase,
} from "./lifecycle";
export type { ShellMatchPhase, StandardMatchPhase } from "./lifecycle";
export type {
  ControllerOrientation,
  ControllerStatePayload,
  ControllerUpdatePlayerProfileAck,
  PlayerProfile,
  PlayerProfilePatch,
} from "./protocol/controller";
export type {
  ConnectionStatus,
  RoomCode,
  RunMode,
  RuntimeState,
} from "./protocol/core";
export type {
  HapticSignalPayload,
  SignalPayload,
  SignalType,
  ToastSignalPayload,
} from "./protocol/signals";

export {
  AirJamErrorBoundary,
  type AirJamErrorBoundaryProps,
  type AirJamErrorFallbackRenderProps,
  type AirJamErrorFallbackRenderer,
  type AirJamRuntimeRole,
} from "./runtime/air-jam-error-boundary";
export {
  createAirJamApp,
  env,
  type AirJamApp,
  type AirJamAppErrorBoundaryOptions,
  type AirJamGameRuntimeConfig,
  type AirJamRuntimeErrorBoundaryOptions,
  type CreateAirJamAppOptions,
} from "./runtime/create-air-jam-app";
export { resolveAirJamBrowserRouterBasename } from "./runtime/router-basename";

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
