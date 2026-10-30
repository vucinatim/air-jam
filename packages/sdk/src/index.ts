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
  useMusicVolume,
  type MusicPlaylistProps,
} from "./audio/music";
export {
  DEFAULT_PLATFORM_SETTINGS,
  DEFAULT_ROOM_PLATFORM_SETTINGS,
  toRoomPlatformSettingsSnapshot,
} from "./settings/platform-settings";
export type {
  PartialRoomPlatformSettingsPatch,
  PlatformAccessibilitySettings,
  PlatformAudioSettings,
  PlatformFeedbackSettings,
  PlatformPreviewControllerSettings,
  PlatformSettings,
  PlatformSettingsPersistence,
  PlatformSettingsSnapshot,
  RoomPlatformSettingsSnapshot,
} from "./settings/platform-settings";
export {
  PlatformSettingsRuntime,
  useInheritedPlatformSettings,
  usePlatformAudioSettings,
  usePlatformSettings,
  type PlatformAudioSettingsApi,
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

export { captureAgentCanvas } from "./agent/capture-canvas";
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
export {
  useControllerToasts,
  type ControllerToast,
  type UseControllerToastsOptions,
} from "./hooks/use-controller-toasts";
export { useHostAgentCapture } from "./hooks/use-host-agent-capture";
export {
  useHostAudioMutePreference,
  type HostAudioMutePreference,
} from "./hooks/use-host-audio-mute-preference";
export { useRoom, type RoomState } from "./hooks/use-room";
export { useSendSignal, type SendSignalFn } from "./hooks/use-send-signal";
export {
  toShellMatchPhase,
  type ShellMatchPhase,
  type StandardMatchPhase,
} from "./lifecycle";
export type { AirJamActionInvocationResult } from "./protocol";
export type {
  ControllerOrientation,
  PlayerProfile,
  PlayerProfilePatch,
} from "./protocol/controller";
export type { ConnectionStatus, RuntimeState } from "./protocol/core";
export type {
  HapticSignalPayload,
  ToastSignalPayload,
} from "./protocol/signals";

export {
  type AirJamErrorFallbackRenderProps,
  type AirJamErrorFallbackRenderer,
  type AirJamRuntimeRole,
} from "./runtime/air-jam-error-boundary";
export {
  createAirJamApp,
  env,
  type AirJamApp,
  type AirJamAppErrorBoundaryOptions,
  type AirJamRuntimeErrorBoundaryOptions,
  type CreateAirJamAppOptions,
} from "./runtime/create-air-jam-app";
export { resolveAirJamBrowserRouterBasename } from "./runtime/router-basename";

export {
  useSimulation,
  useSimulationEvents,
  useSimulationFrame,
  useSimulationSelector,
} from "./hooks/use-simulation";
export {
  useAirJamStore,
  useHostActionListener,
} from "./store/use-air-jam-store";

export type {
  DocumentWithFullscreen,
  ElementWithFullscreen,
} from "./types/browser";

export { useAirJamSettings } from "./hooks/use-air-jam-settings";
