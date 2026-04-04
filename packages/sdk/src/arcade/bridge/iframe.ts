import {
  AIRJAM_BRIDGE_INIT,
  AIRJAM_SETTINGS_SYNC,
  createBridgeHandshake,
  isAirJamSettingsReadyMessage,
  type AirJamBridgeInitMessage,
  type AirJamSettingsReadyMessage,
  type AirJamSettingsSyncMessage,
} from "../../runtime/iframe-bridge";
import {
  AIRJAM_DEV_LOG_SINK_FAILURE,
  AIRJAM_DEV_PROVIDER_MOUNTED,
  AIRJAM_DEV_RUNTIME_EVENT,
  emitAirJamDevRuntimeEvent,
  type AirJamDevRuntimeEventDetail,
} from "../../runtime/dev-runtime-events";
import { AIR_JAM_SDK_VERSION } from "../../runtime/sdk-version";
import type { PlatformSettingsSnapshot } from "../../settings/platform-settings";
export {
  createParentPlatformSettingsBridge,
  type ParentPlatformSettingsBridgeController,
  type ParentPlatformSettingsBridgeEventMap,
  type PlatformSettingsBridgeState,
  type PlatformSettingsBridgeTransport,
} from "../../settings/platform-settings-bridge";

export const createArcadeBridgeInitMessage = (): AirJamBridgeInitMessage => ({
  type: AIRJAM_BRIDGE_INIT,
  payload: {
    handshake: createBridgeHandshake({
      sdkVersion: AIR_JAM_SDK_VERSION,
      runtimeKind: "arcade-runtime",
      capabilityFlags: {
        settingsSync: true,
      },
    }),
  },
});

export const createArcadeSettingsSyncMessage = (
  settings: PlatformSettingsSnapshot,
): AirJamSettingsSyncMessage => ({
  type: AIRJAM_SETTINGS_SYNC,
  payload: {
    settings,
  },
});

export type {
  AirJamBridgeInitMessage,
  AirJamSettingsReadyMessage,
  AirJamSettingsSyncMessage,
};
export {
  AIRJAM_DEV_LOG_SINK_FAILURE,
  AIRJAM_DEV_PROVIDER_MOUNTED,
  AIRJAM_DEV_RUNTIME_EVENT,
  emitAirJamDevRuntimeEvent,
  isAirJamSettingsReadyMessage,
};
export type { AirJamDevRuntimeEventDetail };
