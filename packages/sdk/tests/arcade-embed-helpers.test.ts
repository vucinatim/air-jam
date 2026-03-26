import {
  createArcadeBridgeInitMessage,
  createArcadeSettingsSyncMessage,
} from "../src/arcade/bridge/iframe";
import { buildArcadeGameIframeSrc } from "../src/arcade/url";
import { describe, expect, it } from "vitest";

describe("arcade embed helpers", () => {
  it("builds iframe src with correct query separator", () => {
    expect(
      buildArcadeGameIframeSrc({
        normalizedUrl: "https://game.example/play",
        roomId: "ABCD",
        launchCapability: {
          token: "join_123",
          expiresAt: 1_700_000_000_000,
        },
        joinUrl: "https://platform.example/controller?room=ABCD",
        arcadeSurface: {
          epoch: 3,
          kind: "game",
          gameId: "pong",
        },
      }),
    ).toBe(
      "https://game.example/play?aj_room=ABCD&aj_cap=join_123&aj_cap_exp=1700000000000&aj_join_url=https%3A%2F%2Fplatform.example%2Fcontroller%3Froom%3DABCD&aj_arcade_epoch=3&aj_arcade_kind=game&aj_arcade_game_id=pong&aj_store_domain=aj.embedded.game%3A3%3Apong",
    );

    expect(
      buildArcadeGameIframeSrc({
        normalizedUrl: "https://game.example/play?foo=bar",
        roomId: "ABCD",
        launchCapability: {
          token: "join_123",
          expiresAt: 1_700_000_000_000,
        },
        joinUrl: "https://platform.example/controller?room=ABCD",
        arcadeSurface: {
          epoch: 3,
          kind: "game",
          gameId: "pong",
        },
      }),
    ).toBe(
      "https://game.example/play?foo=bar&aj_room=ABCD&aj_cap=join_123&aj_cap_exp=1700000000000&aj_join_url=https%3A%2F%2Fplatform.example%2Fcontroller%3Froom%3DABCD&aj_arcade_epoch=3&aj_arcade_kind=game&aj_arcade_game_id=pong&aj_store_domain=aj.embedded.game%3A3%3Apong",
    );
  });

  it("creates a versioned bridge init message for arcade runtime", () => {
    const message = createArcadeBridgeInitMessage();

    expect(message.type).toBe("AIRJAM_BRIDGE_INIT");
    expect(message.payload.handshake.protocolVersion).toBe("2");
    expect(typeof message.payload.handshake.sdkVersion).toBe("string");
    expect(message.payload.handshake.sdkVersion.length).toBeGreaterThan(0);
    expect(message.payload.handshake.runtimeKind).toBe("arcade-runtime");
    expect(message.payload.handshake.capabilityFlags.settingsSync).toBe(true);
  });

  it("rejects non-http iframe URLs", () => {
    expect(
      buildArcadeGameIframeSrc({
        normalizedUrl: "javascript:alert(1)",
        roomId: "ABCD",
        launchCapability: {
          token: "join_123",
          expiresAt: 1_700_000_000_000,
        },
        joinUrl: "https://platform.example/controller?room=ABCD",
        arcadeSurface: {
          epoch: 3,
          kind: "game",
          gameId: "pong",
        },
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
