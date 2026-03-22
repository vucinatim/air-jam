import { describe, expect, it } from "vitest";
import { AIR_JAM_PROTOCOL_V2 } from "../src/contracts/v2";
import {
  AIRJAM_BRIDGE_INIT,
  AIRJAM_SETTINGS_SYNC,
  createBridgeHandshake,
  isAirJamSettingsSyncMessage,
  parseAirJamBridgeInitMessage,
} from "../src/runtime/iframe-bridge";

describe("iframe bridge contracts", () => {
  it("creates a valid v2 handshake for arcade runtime bridge", () => {
    const handshake = createBridgeHandshake({
      sdkVersion: "1.2.3",
      runtimeKind: "arcade-runtime",
      capabilityFlags: { settingsSync: true },
    });

    expect(handshake).toEqual({
      protocolVersion: AIR_JAM_PROTOCOL_V2,
      sdkVersion: "1.2.3",
      runtimeKind: "arcade-runtime",
      capabilityFlags: { settingsSync: true },
    });
  });

  it("parses valid bridge init messages and rejects invalid ones", () => {
    const initMessage = {
      type: AIRJAM_BRIDGE_INIT,
      payload: {
        handshake: createBridgeHandshake({
          sdkVersion: "1.0.0",
          runtimeKind: "arcade-runtime",
        }),
      },
    };

    expect(parseAirJamBridgeInitMessage(initMessage)).toEqual(initMessage);
    expect(parseAirJamBridgeInitMessage({ type: "NOPE" })).toBeNull();
  });

  it("recognizes settings sync messages", () => {
    expect(
      isAirJamSettingsSyncMessage({
        type: AIRJAM_SETTINGS_SYNC,
        payload: { masterVolume: 0.5, musicVolume: 0.8, sfxVolume: 1 },
      }),
    ).toBe(true);

    expect(
      isAirJamSettingsSyncMessage({
        type: AIRJAM_SETTINGS_SYNC,
        payload: { masterVolume: "loud" },
      }),
    ).toBe(false);
  });
});
