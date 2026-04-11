// Optional UI entrypoint. Core runtime stays headless at `@air-jam/sdk`.
export * from "./components/connection-status-pill";
export * from "./components/controller-player-name-field";
export * from "./components/controller-primary-action";
export * from "./components/host-mute-button";
export * from "./components/join-url-action-buttons";
export * from "./components/join-url-controls";
export * from "./components/join-url-field";
export * from "./components/lifecycle-action-group";
export * from "./components/player-avatar";
export * from "./components/player-avatar-strip";
export * from "./components/room-qr-code";
export * from "./components/runtime-shell-header";
export * from "./components/surface-viewport";
export * from "./components/ui/button";
export * from "./components/ui/slider";
export * from "./components/volume-controls";
export * from "./hooks/use-controller-lifecycle-intents";
export * from "./hooks/use-controller-lifecycle-permissions";
export * from "./hooks/use-controller-shell-status";
export * from "./hooks/use-host-lobby-shell";
export * from "./hooks/use-lifecycle-action-group-model";
export {
  AIRJAM_DEFAULT_AVATAR_SEEDS,
  getDiceBearAdventurerNeutralUrl,
  getPlayerAvatarImageUrl,
  resolvePlayerAvatarSeed,
} from "./utils/player-avatar-url";
