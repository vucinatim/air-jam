export type {
  AudioHandle,
  PlayOptions,
  SoundCategory,
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
  DEFAULT_DEVICE_SETTINGS,
  DEFAULT_ROOM_SETTINGS,
  DEFAULT_SURFACE_SETTINGS,
  normalizeRoomSettings,
  phoneMayChangeSettings,
  platformSettingDefinitions,
  platformSettingPlacements,
  resolveSurfaceSettings,
} from "./settings/platform-settings";
export type {
  AirJamAudioLevels,
  AirJamSurfaceSettings,
  DeviceSettingsValues,
  PlatformSettingKey,
  PlatformSettingPlacement,
  PlatformSettingScope,
  PlatformSettingSection,
  PlatformSurface,
  RoomSettingsValues,
} from "./settings/platform-settings";
export {
  PlatformSettingsRuntime,
  useAirJamSurfaceSettings,
  useOptionalPlatformSettings,
  usePlatformSettings,
  type PlatformSettingsRuntimeProps,
} from "./settings/platform-settings-runtime";
export { readAirJamSurfaceSettings } from "./settings/surface-settings";

export {
  onAirJamDiagnostic,
  setAirJamDiagnosticsEnabled,
  type AirJamDiagnostic,
  type AirJamDiagnosticCode,
  type AirJamDiagnosticSeverity,
} from "./diagnostics";

export { captureAgentCanvas, drawAgentCanvas } from "./agent/capture-canvas";
export type { PlayerProfileAck, RoomActionAck } from "./core/room-action-ack";
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
  AirJamPlayer,
  PlayerProfile,
  PlayerProfilePatch,
} from "./protocol/controller";
export type { ConnectionStatus } from "./protocol/core";
export type {
  ControllerOrientation,
  HapticSignalPayload,
  RuntimeState,
  ToastSignalPayload,
} from "./room-protocol";

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
export { HoldReveal } from "./runtime/host-reveal";
export { resolveAirJamBrowserRouterBasename } from "./runtime/router-basename";

export {
  useSimulation,
  useSimulationEvents,
  useSimulationFrame,
  useSimulationSelector,
} from "./hooks/use-simulation";
export {
  useAirJamPrivateState,
  useAirJamStore,
  useHostActionListener,
} from "./store/use-air-jam-store";

export type {
  DocumentWithFullscreen,
  ElementWithFullscreen,
} from "./types/browser";

export { useAirJamSettings } from "./hooks/use-air-jam-settings";

export { usePrefabInspection } from "./runtime/prefab-inspection-context";
