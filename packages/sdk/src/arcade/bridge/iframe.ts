import {
  AIRJAM_BRIDGE_INIT,
  AIRJAM_SETTINGS_SYNC,
  createBridgeHandshake,
  type AirJamBridgeInitMessage,
  type AirJamSettingsSyncMessage,
} from "../../runtime/iframe-bridge";
import {
  AIRJAM_DEV_LOG_SINK_FAILURE,
  AIRJAM_DEV_PROVIDER_MOUNTED,
} from "../../runtime/dev-runtime-events";
import { AIR_JAM_SDK_VERSION } from "../../runtime/sdk-version";

export interface ArcadeVolumeSettings {
  masterVolume?: number;
  musicVolume?: number;
  sfxVolume?: number;
}

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

export const createArcadeSettingsSyncMessage = ({
  masterVolume,
  musicVolume,
  sfxVolume,
}: ArcadeVolumeSettings): AirJamSettingsSyncMessage => ({
  type: AIRJAM_SETTINGS_SYNC,
  payload: {
    masterVolume,
    musicVolume,
    sfxVolume,
  },
});

export type { AirJamBridgeInitMessage, AirJamSettingsSyncMessage };
export { AIRJAM_DEV_LOG_SINK_FAILURE, AIRJAM_DEV_PROVIDER_MOUNTED };
