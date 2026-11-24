import { describe, expect, it, vi } from "vitest";
import { AIR_JAM_PROTOCOL_V2 } from "../src/contracts/v2";
import {
  AIRJAM_BRIDGE_INIT,
  AIRJAM_SETTINGS_SYNC,
  createBridgeHandshake,
  isAirJamSettingsSyncMessage,
  parseAirJamBridgeInitMessage,
} from "../src/runtime/iframe-bridge";
import { requestEmbeddingRoom } from "../src/runtime/room-bridge";

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
        payload: {
          settings: {
            audio: {
              masterVolume: 0.5,
              musicVolume: 0.8,
              sfxVolume: 1,
            },
            accessibility: {
              reducedMotion: false,
              highContrast: true,
            },
            feedback: {
              hapticsEnabled: true,
            },
            previewControllers: {
              activeOpacity: 0.9,
            },
          },
        },
      }),
    ).toBe(true);

    expect(
      isAirJamSettingsSyncMessage({
        type: AIRJAM_SETTINGS_SYNC,
        payload: {
          settings: {
            audio: {
              masterVolume: "loud",
            },
          },
        },
      }),
    ).toBe(false);
  });

  it("asks the parent for a room only when a link opens, with one port per link", () => {
    const postMessage = vi.fn();
    const connector = requestEmbeddingRoom({
      parent: {
        window: { postMessage } as unknown as Window,
        origin: "https://arcade.test",
      },
      role: "host",
      context: { arcadeSurface: { epoch: 2, kind: "game", gameId: "pong" } },
    });
    expect(postMessage).not.toHaveBeenCalled();
    const handlers = { open: vi.fn(), message: vi.fn(), close: vi.fn() };
    const first = connector({ role: "host", code: null }, handlers);
    connector({ role: "host", code: null }, handlers);
    expect(postMessage).toHaveBeenCalledTimes(2);
    const [message, origin, transfer] = postMessage.mock.calls[0] ?? [];
    expect(origin).toBe("https://arcade.test");
    expect(message).toMatchObject({
      type: "AIRJAM_ROOM_BRIDGE_REQUEST",
      payload: {
        role: "host",
        arcadeSurface: { epoch: 2, kind: "game", gameId: "pong" },
      },
    });
    expect(transfer[0]).not.toBe(postMessage.mock.calls[1]?.[2][0]);
    first.close();
  });
});
