import { z } from "zod";
import {
  AIR_JAM_PROTOCOL_V2,
  type RuntimeKind,
  type V2Handshake,
  v2HandshakeSchema,
} from "../contracts/v2";
import {
  normalizePlatformSettings,
  type PlatformSettingsSnapshot,
} from "../settings/platform-settings";

export const AIRJAM_BRIDGE_INIT = "AIRJAM_BRIDGE_INIT" as const;
export const AIRJAM_SETTINGS_SYNC = "AIRJAM_SETTINGS_SYNC" as const;
export const AIRJAM_SETTINGS_READY = "AIRJAM_SETTINGS_READY" as const;

export interface AirJamSettingsSyncPayload {
  settings: PlatformSettingsSnapshot;
}

export interface AirJamSettingsSyncMessage {
  type: typeof AIRJAM_SETTINGS_SYNC;
  payload: AirJamSettingsSyncPayload;
}

export interface AirJamBridgeInitMessage {
  type: typeof AIRJAM_BRIDGE_INIT;
  payload: {
    handshake: V2Handshake;
  };
}

export interface AirJamSettingsReadyMessage {
  type: typeof AIRJAM_SETTINGS_READY;
  payload: {
    ready: true;
  };
}

const airJamSettingsSyncSchema = z
  .object({
    type: z.literal(AIRJAM_SETTINGS_SYNC),
    payload: z
      .object({
        settings: z
          .object({
            audio: z
              .object({
                masterVolume: z.number(),
                musicVolume: z.number(),
                sfxVolume: z.number(),
              })
              .strict(),
            accessibility: z
              .object({
                reducedMotion: z.boolean(),
                highContrast: z.boolean(),
              })
              .strict(),
            feedback: z
              .object({
                hapticsEnabled: z.boolean(),
              })
              .strict(),
            previewControllers: z
              .object({
                activeOpacity: z.number(),
              })
              .strict(),
          })
          .strict(),
      })
      .strict(),
  })
  .strict();

const airJamBridgeInitSchema = z
  .object({
    type: z.literal(AIRJAM_BRIDGE_INIT),
    payload: z
      .object({
        handshake: v2HandshakeSchema,
      })
      .strict(),
  })
  .strict();

const airJamSettingsReadySchema = z
  .object({
    type: z.literal(AIRJAM_SETTINGS_READY),
    payload: z
      .object({
        ready: z.literal(true),
      })
      .strict(),
  })
  .strict();

export const createBridgeHandshake = ({
  sdkVersion,
  runtimeKind,
  capabilityFlags = {},
}: {
  sdkVersion: string;
  runtimeKind: RuntimeKind;
  capabilityFlags?: Record<string, boolean>;
}): V2Handshake =>
  v2HandshakeSchema.parse({
    protocolVersion: AIR_JAM_PROTOCOL_V2,
    sdkVersion,
    runtimeKind,
    capabilityFlags,
  });

export const isAirJamSettingsSyncMessage = (
  value: unknown,
): value is AirJamSettingsSyncMessage => {
  const result = airJamSettingsSyncSchema.safeParse(value);
  return (
    result.success && !!normalizePlatformSettings(result.data.payload.settings)
  );
};

export const parseAirJamBridgeInitMessage = (
  value: unknown,
): AirJamBridgeInitMessage | null => {
  const result = airJamBridgeInitSchema.safeParse(value);
  return result.success ? result.data : null;
};

export const isAirJamSettingsReadyMessage = (
  value: unknown,
): value is AirJamSettingsReadyMessage => {
  return airJamSettingsReadySchema.safeParse(value).success;
};
