import {
  AIR_JAM_SDK_VERSION,
  AIRJAM_BRIDGE_INIT,
  AIRJAM_SETTINGS_SYNC,
  appendRuntimeQueryParams,
  arcadeSurfaceRuntimeUrlParams,
  createBridgeHandshake,
  type AirJamBridgeInitMessage,
  type AirJamSettingsSyncMessage,
  type ArcadeSurfaceRuntimeIdentity,
} from "@air-jam/sdk";

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

export const buildArcadeGameIframeSrc = ({
  normalizedUrl,
  roomId,
  joinToken,
  joinUrl,
  arcadeSurface,
}: {
  normalizedUrl: string;
  roomId: string;
  joinToken: string;
  joinUrl?: string | null;
  arcadeSurface: ArcadeSurfaceRuntimeIdentity;
}): string | null =>
  appendRuntimeQueryParams(normalizedUrl, {
    aj_room: roomId,
    aj_token: joinToken,
    aj_join_url: joinUrl,
    ...arcadeSurfaceRuntimeUrlParams(arcadeSurface),
  });
