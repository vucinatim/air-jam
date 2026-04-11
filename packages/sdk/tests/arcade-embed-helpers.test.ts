import { resolveRuntimeTopology } from "@air-jam/runtime-topology";
import {
  createArcadeBridgeInitMessage,
  createArcadeSettingsSyncMessage,
} from "../src/arcade/bridge/iframe";
import {
  buildArcadeControllerRuntimeUrl,
  buildArcadeGameIframeSrc,
} from "../src/arcade/url";
import { describe, expect, it } from "vitest";

const embeddedTopology = resolveRuntimeTopology({
  runtimeMode: "arcade-live",
  surfaceRole: "host",
  appOrigin: "https://game.example",
  backendOrigin: "https://api.example",
  publicHost: "https://platform.example",
  embedded: true,
  embedParentOrigin: "https://platform.example",
});

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
        topology: embeddedTopology,
        arcadeSurface: {
          epoch: 3,
          kind: "game",
          gameId: "pong",
        },
      }),
    ).toBe(
      "https://game.example/play?aj_room=ABCD&aj_cap=join_123&aj_cap_exp=1700000000000&aj_join_url=https%3A%2F%2Fplatform.example%2Fcontroller%3Froom%3DABCD&aj_topology_runtime_mode=arcade-live&aj_topology_surface_role=host&aj_topology_app_origin=https%3A%2F%2Fgame.example&aj_topology_backend_origin=https%3A%2F%2Fapi.example&aj_topology_socket_origin=https%3A%2F%2Fapi.example&aj_topology_public_host=https%3A%2F%2Fplatform.example&aj_topology_asset_base_path=%2F&aj_topology_secure_transport=true&aj_topology_embedded=true&aj_topology_proxy_strategy=none&aj_topology_embed_parent_origin=https%3A%2F%2Fplatform.example&aj_arcade_epoch=3&aj_arcade_kind=game&aj_arcade_game_id=pong&aj_store_domain=aj.embedded.game%3A3%3Apong",
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
        topology: embeddedTopology,
        arcadeSurface: {
          epoch: 3,
          kind: "game",
          gameId: "pong",
        },
      }),
    ).toBe(
      "https://game.example/play?foo=bar&aj_room=ABCD&aj_cap=join_123&aj_cap_exp=1700000000000&aj_join_url=https%3A%2F%2Fplatform.example%2Fcontroller%3Froom%3DABCD&aj_topology_runtime_mode=arcade-live&aj_topology_surface_role=host&aj_topology_app_origin=https%3A%2F%2Fgame.example&aj_topology_backend_origin=https%3A%2F%2Fapi.example&aj_topology_socket_origin=https%3A%2F%2Fapi.example&aj_topology_public_host=https%3A%2F%2Fplatform.example&aj_topology_asset_base_path=%2F&aj_topology_secure_transport=true&aj_topology_embedded=true&aj_topology_proxy_strategy=none&aj_topology_embed_parent_origin=https%3A%2F%2Fplatform.example&aj_arcade_epoch=3&aj_arcade_kind=game&aj_arcade_game_id=pong&aj_store_domain=aj.embedded.game%3A3%3Apong",
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
        topology: embeddedTopology,
        arcadeSurface: {
          epoch: 3,
          kind: "game",
          gameId: "pong",
        },
      }),
    ).toBeNull();
  });

  it("builds controller runtime URLs from the game runtime origin", () => {
    expect(
      buildArcadeControllerRuntimeUrl("http://127.0.0.1:5173/?foo=bar"),
    ).toBe("http://127.0.0.1:5173/controller");

    expect(
      buildArcadeControllerRuntimeUrl(
        "https://game.example/play?foo=bar#debug",
      ),
    ).toBe("https://game.example/controller");

    expect(
      buildArcadeControllerRuntimeUrl(
        "http://localhost:3000/airjam-local-builds/pong",
      ),
    ).toBe("http://localhost:3000/airjam-local-builds/pong/controller");

    expect(
      buildArcadeControllerRuntimeUrl(
        "https://platform.example/releases/g/game-id/r/release-id/",
      ),
    ).toBe(
      "https://platform.example/releases/g/game-id/r/release-id/controller",
    );
  });

  it("creates settings sync message payload", () => {
    const message = createArcadeSettingsSyncMessage({
      audio: {
        masterVolume: 0.8,
        musicVolume: 0.6,
        sfxVolume: 0.4,
      },
      accessibility: {
        reducedMotion: true,
        highContrast: false,
      },
      feedback: {
        hapticsEnabled: true,
      },
    });

    expect(message).toEqual({
      type: "AIRJAM_SETTINGS_SYNC",
      payload: {
        settings: {
          audio: {
            masterVolume: 0.8,
            musicVolume: 0.6,
            sfxVolume: 0.4,
          },
          accessibility: {
            reducedMotion: true,
            highContrast: false,
          },
          feedback: {
            hapticsEnabled: true,
          },
        },
      },
    });
  });
});
