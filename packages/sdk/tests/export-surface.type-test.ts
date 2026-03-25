import type {
  AirJamControllerApi,
  PlayerProfile,
  SignalPayload,
  SoundManifest,
} from "../src/index";

type SDK = typeof import("../src/index");
type Has<K extends string> = K extends keyof SDK ? true : false;
type AssertTrue<T extends true> = T;
type AssertFalse<T extends false> = T;

export type __assert_host_provider_exported = AssertTrue<
  Has<"HostSessionProvider">
>;
export type __assert_controller_provider_exported = AssertTrue<
  Has<"ControllerSessionProvider">
>;
export type __assert_controller_session_hook_exported = AssertTrue<
  Has<"useControllerSession">
>;
export type __assert_create_airjam_app_exported = AssertTrue<
  Has<"createAirJamApp">
>;
export type __assert_env_exported = AssertTrue<
  Has<"env">
>;
export type __assert_host_session_hook_exported = AssertTrue<
  Has<"useHostSession">
>;
export type __assert_player_profile_importable = AssertTrue<
  PlayerProfile extends object ? true : false
>;
export type __assert_signal_payload_importable = AssertTrue<
  SignalPayload extends object ? true : false
>;
export type __assert_sound_manifest_importable = AssertTrue<
  SoundManifest extends Record<string, unknown> ? true : false
>;
export type __assert_define_airjam_config_not_exported = AssertFalse<
  Has<"defineAirJamConfig">
>;
export type __assert_airjam_provider_not_exported = AssertFalse<
  Has<"AirJamProvider">
>;
export type __assert_context_hooks_not_exported = AssertFalse<
  Has<"useAirJamContext">
>;
export type __assert_socket_manager_not_exported = AssertFalse<
  Has<"SocketManager">
>;
export type __assert_resolve_airjam_config_not_exported = AssertFalse<
  Has<"resolveAirJamConfig">
>;
export type __assert_controller_realtime_client_not_exported = AssertFalse<
  Has<"getControllerRealtimeClient">
>;
export type __assert_host_realtime_client_not_exported = AssertFalse<
  Has<"getHostRealtimeClient">
>;
export type __assert_embedded_host_reader_not_exported = AssertFalse<
  Has<"readEmbeddedHostChildSession">
>;
export type __assert_embedded_controller_reader_not_exported = AssertFalse<
  Has<"readEmbeddedControllerChildSession">
>;
export type __assert_generate_room_code_not_exported = AssertFalse<
  Has<"generateRoomCode">
>;
export type __assert_generate_controller_id_not_exported = AssertFalse<
  Has<"generateControllerId">
>;
export type __assert_network_ip_not_exported = AssertFalse<
  Has<"getLocalNetworkIp">
>;
export type __assert_default_server_port_not_exported = AssertFalse<
  Has<"DEFAULT_SERVER_PORT">
>;
export type __assert_controller_path_not_exported = AssertFalse<
  Has<"CONTROLLER_PATH">
>;
export type __assert_events_namespace_not_exported = AssertFalse<
  Has<"Events">
>;
export type __assert_url_builder_not_exported = AssertFalse<
  Has<"urlBuilder">
>;
export type __assert_arcade_surface_domain_not_exported = AssertFalse<
  Has<"AIR_JAM_ARCADE_SURFACE_STORE_DOMAIN">
>;
export type __assert_sdk_version_not_exported = AssertFalse<
  Has<"AIR_JAM_SDK_VERSION">
>;
export type __assert_create_bridge_handshake_not_exported = AssertFalse<
  Has<"createBridgeHandshake">
>;
export type __assert_arcade_runtime_url_params_not_exported = AssertFalse<
  Has<"arcadeSurfaceRuntimeUrlParams">
>;
export type __assert_controller_bridge_attach_not_exported = AssertFalse<
  Has<"createControllerBridgeAttachMessage">
>;
export type __assert_host_bridge_attach_not_exported = AssertFalse<
  Has<"createHostBridgeAttachMessage">
>;
export type __assert_arcade_surface_mismatch_not_exported = AssertFalse<
  Has<"isArcadeSurfaceMismatch">
>;
export type __assert_state_sync_payload_not_exported = AssertFalse<
  Has<"AirJamStateSyncPayload">
>;
export type __assert_action_rpc_payload_not_exported = AssertFalse<
  Has<"AirJamActionRpcPayload">
>;
export type __assert_controller_welcome_not_exported = AssertFalse<
  Has<"ControllerWelcomePayload">
>;
export type __assert_use_audio_manager_not_exported = AssertFalse<
  Has<"useAudioManager">
>;
export type __assert_settings_sync_init_not_exported = AssertFalse<
  Has<"initializeParentSettingsSync">
>;
export type __assert_internal_store_action_name_not_exported = AssertFalse<
  Has<"isInternalActionName">
>;

type ControllerHas<K extends string> =
  K extends keyof AirJamControllerApi ? true : false;

export type __assert_controller_send_input_not_exported = AssertFalse<
  ControllerHas<"sendInput">
>;
