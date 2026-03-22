import type { AirJamControllerApi } from "../src/index";

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
export type __assert_create_airjam_app_exported = AssertTrue<
  Has<"createAirJamApp">
>;
export type __assert_env_exported = AssertTrue<
  Has<"env">
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

type ControllerHas<K extends string> =
  K extends keyof AirJamControllerApi ? true : false;

export type __assert_controller_send_input_not_exported = AssertFalse<
  ControllerHas<"sendInput">
>;
