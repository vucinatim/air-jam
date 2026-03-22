import { z } from "zod";
import {
  AIR_JAM_PROTOCOL_V2,
  type RuntimeKind,
  type V2Handshake,
  v2HandshakeSchema,
} from "../contracts/v2";

export const AIRJAM_BRIDGE_INIT = "AIRJAM_BRIDGE_INIT" as const;
export const AIRJAM_SETTINGS_SYNC = "AIRJAM_SETTINGS_SYNC" as const;

export interface AirJamSettingsSyncPayload {
  masterVolume?: number;
  musicVolume?: number;
  sfxVolume?: number;
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

const airJamSettingsSyncSchema = z
  .object({
    type: z.literal(AIRJAM_SETTINGS_SYNC),
    payload: z
      .object({
        masterVolume: z.number().optional(),
        musicVolume: z.number().optional(),
        sfxVolume: z.number().optional(),
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

export const createBridgeHandshake = ({
  sdkVersion,
  runtimeKind,
  capabilityFlags = {},
}: {
  sdkVersion: string;
  runtimeKind: RuntimeKind;
  capabilityFlags?: Record<string, boolean>;
}): V2Handshake => {
  return v2HandshakeSchema.parse({
    protocolVersion: AIR_JAM_PROTOCOL_V2,
    sdkVersion,
    runtimeKind,
    capabilityFlags,
  });
};

export const isAirJamSettingsSyncMessage = (
  value: unknown,
): value is AirJamSettingsSyncMessage => {
  return airJamSettingsSyncSchema.safeParse(value).success;
};

export const parseAirJamBridgeInitMessage = (
  value: unknown,
): AirJamBridgeInitMessage | null => {
  const result = airJamBridgeInitSchema.safeParse(value);
  return result.success ? result.data : null;
};
