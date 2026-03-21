import { ErrorCode } from "@air-jam/sdk/protocol";
import { describe, expect, it } from "vitest";
import type { AuthService } from "../src/services/auth-service";
import { setupServerTestHarness } from "./helpers/server-test-harness";

type HostCreateRoomAck = {
  ok: boolean;
  roomId?: string;
  code?: ErrorCode | string;
  message?: string;
};

describe("server auth and rate limiting", () => {
  describe("auth checks", () => {
    const authService = {
      verifyApiKey: async (apiKey?: string) => {
        if (apiKey === "valid-key") {
          return { isVerified: true };
        }
        return { isVerified: false, error: "Unauthorized" };
      },
    } as AuthService;
    const harness = setupServerTestHarness({
      server: { authService },
    });

    it("rejects invalid API keys when auth is required", async () => {
      const host = await harness.connectSocket();

      const invalidAck = await harness.emitWithAck<HostCreateRoomAck>(
        host,
        "host:createRoom",
        { maxPlayers: 4, apiKey: "invalid-key" },
      );

      expect(invalidAck.ok).toBe(false);
      expect(invalidAck.code).toBe(ErrorCode.INVALID_API_KEY);

      const validAck = await harness.emitWithAck<HostCreateRoomAck>(
        host,
        "host:createRoom",
        { maxPlayers: 4, apiKey: "valid-key" },
      );

      expect(validAck.ok).toBe(true);
      expect(validAck.roomId).toBeTypeOf("string");
    });
  });

  describe("host registration limits", () => {
    const harness = setupServerTestHarness({
      server: {
        authService: {
          verifyApiKey: async () => ({ isVerified: true }),
        } as AuthService,
        rateLimitWindowMs: 60_000,
        hostRegistrationRateLimitMax: 1,
      },
    });

    it("rate limits repeated host:createRoom calls from the same socket", async () => {
      const host = await harness.connectSocket();

      const firstAck = await harness.emitWithAck<HostCreateRoomAck>(
        host,
        "host:createRoom",
        { maxPlayers: 4 },
      );
      expect(firstAck.ok).toBe(true);

      const secondAck = await harness.emitWithAck<HostCreateRoomAck>(
        host,
        "host:createRoom",
        { maxPlayers: 4 },
      );

      expect(secondAck.ok).toBe(false);
      expect(secondAck.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    });
  });

  describe("controller join limits", () => {
    const harness = setupServerTestHarness({
      server: {
        authService: {
          verifyApiKey: async () => ({ isVerified: true }),
        } as AuthService,
        rateLimitWindowMs: 60_000,
        hostRegistrationRateLimitMax: 10,
        controllerJoinRateLimitMax: 1,
      },
    });

    it("rate limits repeated controller:join calls from the same socket", async () => {
      const host = await harness.connectSocket();
      const controller = await harness.connectSocket();

      const createAck = await harness.emitWithAck<HostCreateRoomAck>(
        host,
        "host:createRoom",
        { maxPlayers: 4 },
      );

      expect(createAck.ok).toBe(true);
      const roomId = createAck.roomId!;

      const firstJoinAck = await harness.emitWithAck<{
        ok: boolean;
        code?: ErrorCode | string;
      }>(controller, "controller:join", {
        roomId,
        controllerId: "ctrl_limit_1",
        nickname: "Limiter",
      });

      expect(firstJoinAck.ok).toBe(true);

      const secondJoinAck = await harness.emitWithAck<{
        ok: boolean;
        code?: ErrorCode | string;
      }>(controller, "controller:join", {
        roomId,
        controllerId: "ctrl_limit_1",
        nickname: "Limiter",
      });

      expect(secondJoinAck.ok).toBe(false);
      expect(secondJoinAck.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    });
  });
});
