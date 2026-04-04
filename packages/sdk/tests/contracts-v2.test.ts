import { describe, expect, it } from "vitest";
import {
  AIR_JAM_PROTOCOL_V2,
  parseV2BridgeMessage,
  v2BridgeMessageSchema,
  v2HandshakeSchema,
} from "../src/contracts/v2";

describe("contracts v2 handshake", () => {
  it("accepts a valid handshake payload", () => {
    const parsed = v2HandshakeSchema.safeParse({
      protocolVersion: AIR_JAM_PROTOCOL_V2,
      sdkVersion: "1.0.0",
      runtimeKind: "arcade-runtime",
      capabilityFlags: {
        persistentRoom: true,
        bridgeTransport: true,
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects mismatched protocol versions", () => {
    const parsed = v2HandshakeSchema.safeParse({
      protocolVersion: "3",
      sdkVersion: "1.0.0",
      runtimeKind: "arcade-runtime",
      capabilityFlags: {},
    });

    expect(parsed.success).toBe(false);
  });
});

describe("contracts v2 bridge messages", () => {
  it("accepts valid parent and game bridge messages", () => {
    const messages = [
      {
        type: "BOOTSTRAP",
        payload: {
          roomId: "ABCD",
          players: [{ id: "p1", label: "Player 1", color: "#38bdf8" }],
          state: { gameState: "paused", message: "Ready" },
          capabilities: { canPause: true },
        },
      },
      {
        type: "PLAYERS_UPDATE",
        payload: {
          players: [{ id: "p1", label: "Player 1", color: "#38bdf8" }],
        },
      },
      {
        type: "GAME_STATE_UPDATE",
        payload: {
          gameState: "playing",
          message: "Round started",
        },
      },
      {
        type: "READY",
        payload: { readyAtMs: 1000 },
      },
      {
        type: "STATE_PATCH",
        payload: { patch: { score: 1, active: true } },
      },
      {
        type: "INPUT_FRAME",
        payload: {
          frameId: 1,
          inputs: [
            {
              controllerId: "p1",
              input: { vector: { x: 0, y: 1 }, action: true },
            },
          ],
        },
      },
      {
        type: "PAUSE",
        payload: { reason: "host-request" },
      },
      {
        type: "RESUME",
        payload: {},
      },
      {
        type: "SHUTDOWN",
        payload: { reason: "game-exit" },
      },
      {
        type: "METRICS",
        payload: {
          values: {
            frameTimeMs: 16.6,
            inputLatencyMs: 12,
          },
        },
      },
      {
        type: "SIGNAL",
        payload: {
          signalType: "HAPTIC",
          targetId: "p1",
          data: { pattern: "light" },
        },
      },
      {
        type: "ERROR",
        payload: {
          code: "RUNTIME_FAILURE",
          message: "Unexpected state",
          details: { frameId: 99 },
        },
      },
    ] as const;

    messages.forEach((message) => {
      const parsed = v2BridgeMessageSchema.safeParse(message);
      expect(parsed.success).toBe(true);
    });
  });

  it("rejects messages missing required fields", () => {
    const parsed = v2BridgeMessageSchema.safeParse({
      type: "BOOTSTRAP",
      payload: {
        roomId: "ABCD",
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("supports explicit unknown message policy", () => {
    const unknownMessage = {
      type: "SOMETHING_NEW",
      payload: {},
    };

    const rejected = parseV2BridgeMessage(unknownMessage, "reject");
    expect(rejected.status).toBe("invalid");

    const ignored = parseV2BridgeMessage(unknownMessage, "ignore");
    expect(ignored.status).toBe("ignored_unknown_type");
  });
});
