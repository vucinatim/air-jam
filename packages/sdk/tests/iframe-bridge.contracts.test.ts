import { describe, expect, it } from "vitest";
import { AIR_JAM_PROTOCOL_V2 } from "../src/contracts/v2";
import { splitBridgeEnvelopeArgs } from "../src/runtime/bridge-envelope-args";
import {
  createControllerBridgeEmitMessage,
  createControllerBridgeEventMessage,
} from "../src/runtime/controller-bridge";
import {
  createHostBridgeEmitMessage,
  createHostBridgeEventMessage,
} from "../src/runtime/host-bridge";
import {
  AIRJAM_BRIDGE_INIT,
  AIRJAM_SETTINGS_SYNC,
  createBridgeHandshake,
  isAirJamSettingsSyncMessage,
  parseAirJamBridgeInitMessage,
} from "../src/runtime/iframe-bridge";

describe("iframe bridge contracts", () => {
  it("preserves every required argument before extracting envelope options", () => {
    const payload = { requestId: "payload-id" };
    const options = { requestId: "envelope-id" };
    expect(splitBridgeEnvelopeArgs([payload, payload], 2)).toEqual({
      eventArgs: [payload, payload],
    });
    expect(splitBridgeEnvelopeArgs([payload, payload, options], 2)).toEqual({
      eventArgs: [payload, payload],
      requestId: "envelope-id",
    });
    expect(splitBridgeEnvelopeArgs([options], 0)).toEqual({
      eventArgs: [],
      requestId: "envelope-id",
    });
    expect(
      createControllerBridgeEventMessage(
        "disconnect",
        "transport close",
        options,
      ).payload,
    ).toEqual({
      event: "disconnect",
      args: ["transport close"],
      requestId: "envelope-id",
    });
  });

  it("preserves correlated sync payloads across both sides of the bridge", () => {
    const request = {
      roomId: "ABCD",
      storeDomain: "game",
      requestId: "sync-1",
    };
    const response = { ...request, revision: 1, data: { score: 3 } };
    const messages = [
      createHostBridgeEventMessage("airjam:state_sync_request", request),
      createControllerBridgeEmitMessage(
        "controller:state_sync_request",
        request,
      ),
      createHostBridgeEmitMessage("host:state_sync", response),
      createControllerBridgeEventMessage("airjam:state_sync", response),
    ];
    for (const [index, message] of messages.entries()) {
      expect(message.payload.args).toEqual([index < 2 ? request : response]);
      expect(message.payload.requestId).toBeUndefined();
    }
  });

  it("keeps transport acknowledgements distinct from sync correlation IDs", () => {
    const request = {
      roomId: "ABCD",
      storeDomain: "game",
      requestId: "sync-1",
    };
    const options = { requestId: "bridge-ack-1" };
    const response = { ...request, revision: 1, data: {} };
    const messages = [
      createHostBridgeEventMessage(
        "airjam:state_sync_request",
        request,
        options,
      ),
      createControllerBridgeEmitMessage(
        "controller:state_sync_request",
        request,
        options,
      ),
      createHostBridgeEmitMessage("host:state_sync", response, options),
      createControllerBridgeEventMessage(
        "airjam:state_sync",
        response,
        options,
      ),
    ];
    for (const [index, message] of messages.entries()) {
      expect(message.payload.args).toEqual([index < 2 ? request : response]);
      expect(message.payload.requestId).toBe("bridge-ack-1");
    }
    expect(
      createHostBridgeEventMessage("connect", options).payload,
    ).toMatchObject({ args: [], requestId: "bridge-ack-1" });
    expect(
      createControllerBridgeEventMessage(
        "disconnect",
        "transport close",
        options,
      ).payload,
    ).toMatchObject({ args: ["transport close"], requestId: "bridge-ack-1" });
  });

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
});
