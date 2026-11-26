import { z } from "zod";
import {
  AIR_JAM_PROTOCOL_V2,
  v2HandshakeSchema,
  type RuntimeKind,
  type V2Handshake,
} from "../contracts/v2";
import {
  airJamSettingSchema,
  airJamSettingsValuesSchema,
} from "../core/settings";
import {
  airJamSurfaceSettingsSchema,
  type AirJamSurfaceSettings,
} from "../settings/platform-settings";

export const AIRJAM_BRIDGE_INIT = "AIRJAM_BRIDGE_INIT" as const;
export const AIRJAM_SETTINGS_SYNC = "AIRJAM_SETTINGS_SYNC" as const;
export const AIRJAM_SETTINGS_READY = "AIRJAM_SETTINGS_READY" as const;
export const AIRJAM_GAME_SETTINGS = "AIRJAM_GAME_SETTINGS" as const;
export const AIRJAM_GAME_SETTINGS_UPDATE =
  "AIRJAM_GAME_SETTINGS_UPDATE" as const;
export const AIRJAM_GAME_SETTINGS_RESULT =
  "AIRJAM_GAME_SETTINGS_RESULT" as const;

export interface AirJamSettingsSyncPayload {
  settings: AirJamSurfaceSettings;
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
    payload: z.object({ settings: airJamSurfaceSettingsSchema }).strict(),
  })
  .strict();

/** A game's declared settings and their values, as its host holds them. */
export const airJamGameSettingsStateSchema = z
  .object({
    declaration: z.record(z.string(), airJamSettingSchema),
    values: airJamSettingsValuesSchema,
    revision: z.number().int().nonnegative(),
  })
  .strict();
export type AirJamGameSettingsState = z.infer<
  typeof airJamGameSettingsStateSchema
>;

/** Game to platform, over the bridge port: the current declared settings. */
export const airJamGameSettingsMessageSchema = z
  .object({
    type: z.literal(AIRJAM_GAME_SETTINGS),
    payload: airJamGameSettingsStateSchema.nullable(),
  })
  .strict();

/** Platform to game, over the bridge port: change values at a revision. */
export const airJamGameSettingsUpdateMessageSchema = z
  .object({
    type: z.literal(AIRJAM_GAME_SETTINGS_UPDATE),
    payload: z
      .object({
        requestId: z.string().min(1).max(128),
        patch: airJamSettingsValuesSchema,
        expectedRevision: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const airJamGameSettingsResultMessageSchema = z
  .object({
    type: z.literal(AIRJAM_GAME_SETTINGS_RESULT),
    payload: z.discriminatedUnion("ok", [
      z.object({ requestId: z.string(), ok: z.literal(true) }).strict(),
      z
        .object({
          requestId: z.string(),
          ok: z.literal(false),
          error: z.string().min(1).max(1024),
        })
        .strict(),
    ]),
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
  return airJamSettingsSyncSchema.safeParse(value).success;
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
