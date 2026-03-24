import { AIR_JAM_SDK_VERSION } from "@air-jam/sdk";
import { describe, expect, it } from "vitest";
import {
  buildArcadeGameIframeSrc,
  createArcadeBridgeInitMessage,
  createArcadeSettingsSyncMessage,
} from "./arcade-bridge";

describe("arcade bridge helpers", () => {
  it("builds iframe src with correct query separator", () => {
    expect(
      buildArcadeGameIframeSrc({
        normalizedUrl: "https://game.example/play",
        roomId: "ABCD",
        joinToken: "join_123",
        joinUrl: "https://platform.example/controller?room=ABCD",
      }),
    ).toBe(
      "https://game.example/play?aj_room=ABCD&aj_token=join_123&aj_join_url=https%3A%2F%2Fplatform.example%2Fcontroller%3Froom%3DABCD",
    );

    expect(
      buildArcadeGameIframeSrc({
        normalizedUrl: "https://game.example/play?foo=bar",
        roomId: "ABCD",
        joinToken: "join_123",
        joinUrl: "https://platform.example/controller?room=ABCD",
      }),
    ).toBe(
      "https://game.example/play?foo=bar&aj_room=ABCD&aj_token=join_123&aj_join_url=https%3A%2F%2Fplatform.example%2Fcontroller%3Froom%3DABCD",
    );
  });

  it("creates a versioned bridge init message for arcade runtime", () => {
    const message = createArcadeBridgeInitMessage();

    expect(message.type).toBe("AIRJAM_BRIDGE_INIT");
    expect(message.payload.handshake.protocolVersion).toBe("2");
    expect(message.payload.handshake.sdkVersion).toBe(AIR_JAM_SDK_VERSION);
    expect(message.payload.handshake.runtimeKind).toBe("arcade-runtime");
    expect(message.payload.handshake.capabilityFlags.settingsSync).toBe(true);
  });

  it("rejects non-http iframe URLs", () => {
    expect(
      buildArcadeGameIframeSrc({
        normalizedUrl: "javascript:alert(1)",
        roomId: "ABCD",
        joinToken: "join_123",
        joinUrl: "https://platform.example/controller?room=ABCD",
      }),
    ).toBeNull();
  });

  it("creates settings sync message payload", () => {
    const message = createArcadeSettingsSyncMessage({
      masterVolume: 0.8,
      musicVolume: 0.6,
      sfxVolume: 0.4,
    });

    expect(message).toEqual({
      type: "AIRJAM_SETTINGS_SYNC",
      payload: {
        masterVolume: 0.8,
        musicVolume: 0.6,
        sfxVolume: 0.4,
      },
    });
  });
});
