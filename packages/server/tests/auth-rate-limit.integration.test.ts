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
      verifyHostBootstrap: async ({ appId }: { appId?: string }) => {
        if (appId === "valid-key") {
          return { isVerified: true, appId, verifiedVia: "appId" as const };
        }
        return { isVerified: false, error: "Unauthorized" };
      },
    } as AuthService;
    const harness = setupServerTestHarness({
      server: { authService },
    });

    it("rejects invalid app IDs when auth is required", async () => {
      const host = await harness.connectSocket();

      const invalidBootstrapAck = await harness.bootstrapHost(
        host,
        "invalid-key",
      );

      expect(invalidBootstrapAck.ok).toBe(false);
      expect(invalidBootstrapAck.code).toBe(ErrorCode.INVALID_APP_ID);

      const validBootstrapAck = await harness.bootstrapHost(host, "valid-key");
      expect(validBootstrapAck.ok).toBe(true);

      const validAck = await harness.emitWithAck<HostCreateRoomAck>(
        host,
        "host:createRoom",
        { maxPlayers: 4 },
      );

      expect(validAck.ok).toBe(true);
      expect(validAck.roomId).toBeTypeOf("string");
    });

    it("rejects privileged host lifecycle calls before bootstrap", async () => {
      const host = await harness.connectSocket();

      const ack = await harness.emitWithAck<HostCreateRoomAck>(
        host,
        "host:createRoom",
        { maxPlayers: 4 },
      );

      expect(ack.ok).toBe(false);
      expect(ack.code).toBe(ErrorCode.UNAUTHORIZED);
    });
  });

  describe("static-mode origin policy", () => {
    const authService = {
      verifyHostBootstrap: async ({
        appId,
        origin,
      }: {
        appId?: string;
        origin?: string;
      }) => {
        if (appId !== "valid-key") {
          return { isVerified: false, error: "Unauthorized" };
        }
        if (origin !== "https://allowed.example") {
          return {
            isVerified: false,
            error: "Unauthorized: Origin not allowed for this App ID",
          };
        }
        return { isVerified: true, appId, verifiedVia: "appId" as const };
      },
    } as AuthService;
    const harness = setupServerTestHarness({
      server: { authService },
    });

    it("accepts bootstrap from an allowed origin", async () => {
      const host = await harness.connectSocket({
        origin: "https://allowed.example",
      });

      const ack = await harness.bootstrapHost(host, "valid-key");

      expect(ack.ok).toBe(true);
    });

    it("rejects bootstrap from a disallowed origin", async () => {
      const host = await harness.connectSocket({
        origin: "https://blocked.example",
      });

      const ack = await harness.bootstrapHost(host, "valid-key");

      expect(ack.ok).toBe(false);
      expect(ack.code).toBe(ErrorCode.INVALID_APP_ID);
      expect(ack.message).toBe(
        "Unauthorized: Origin not allowed for this App ID",
      );
    });
  });

  describe("host registration limits", () => {
    const harness = setupServerTestHarness({
      server: {
        authService: {
          verifyHostBootstrap: async ({ appId }: { appId?: string }) => ({
            isVerified: true,
            appId,
            verifiedVia: "appId" as const,
          }),
        } as AuthService,
        rateLimitWindowMs: 60_000,
        hostRegistrationRateLimitMax: 1,
      },
    });

    it("rate limits repeated host:createRoom calls from the same socket", async () => {
      const host = await harness.connectSocket();
      const bootstrapAck = await harness.bootstrapHost(host);
      expect(bootstrapAck.ok).toBe(true);

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

  describe("static app quotas", () => {
    const authService = {
      verifyHostBootstrap: async ({
        appId,
        origin,
      }: {
        appId?: string;
        origin?: string;
      }) => ({
        isVerified: true,
        appId,
        verifiedVia: "appId" as const,
        verifiedOrigin: origin,
      }),
    } as AuthService;

    const bootstrapHarness = setupServerTestHarness({
      server: {
        authService,
        hostRegistrationRateLimitMax: 10,
        staticAppRateLimitMax: 1,
        rateLimitWindowMs: 60_000,
      },
    });

    const lifecycleHarness = setupServerTestHarness({
      server: {
        authService,
        hostRegistrationRateLimitMax: 10,
        staticAppRateLimitMax: 2,
        rateLimitWindowMs: 60_000,
      },
    });

    it("rate limits repeated bootstrap attempts for the same static app scope", async () => {
      const firstHost = await bootstrapHarness.connectSocket({
        origin: "https://allowed.example",
      });
      const secondHost = await bootstrapHarness.connectSocket({
        origin: "https://allowed.example",
      });

      const firstAck = await bootstrapHarness.bootstrapHost(
        firstHost,
        "valid-key",
      );
      expect(firstAck.ok).toBe(true);

      const secondAck = await bootstrapHarness.bootstrapHost(
        secondHost,
        "valid-key",
      );
      expect(secondAck.ok).toBe(false);
      expect(secondAck.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(secondAck.message).toBe(
        "Too many bootstrap attempts for this app. Please try again.",
      );
    });

    it("rate limits repeated lifecycle actions for the same static app scope across sockets", async () => {
      const firstHost = await lifecycleHarness.connectSocket({
        origin: "https://allowed.example",
      });
      const thirdHost = await lifecycleHarness.connectSocket({
        origin: "https://allowed.example",
      });
      const secondHost = await lifecycleHarness.connectSocket({
        origin: "https://blocked.example",
      });

      expect(
        (await lifecycleHarness.bootstrapHost(firstHost, "valid-key")).ok,
      ).toBe(true);
      expect(
        (await lifecycleHarness.bootstrapHost(thirdHost, "valid-key")).ok,
      ).toBe(true);
      const firstCreateAck =
        await lifecycleHarness.emitWithAck<HostCreateRoomAck>(
          firstHost,
          "host:createRoom",
          { maxPlayers: 4 },
        );
      expect(firstCreateAck.ok).toBe(true);

      expect(
        (await lifecycleHarness.bootstrapHost(secondHost, "other-key")).ok,
      ).toBe(true);
      const secondCreateAck =
        await lifecycleHarness.emitWithAck<HostCreateRoomAck>(
          secondHost,
          "host:createRoom",
          { maxPlayers: 4 },
        );
      expect(secondCreateAck.ok).toBe(true);

      const thirdCreateAck =
        await lifecycleHarness.emitWithAck<HostCreateRoomAck>(
          thirdHost,
          "host:createRoom",
          { maxPlayers: 4 },
        );
      expect(thirdCreateAck.ok).toBe(true);

      const throttledAck =
        await lifecycleHarness.emitWithAck<HostCreateRoomAck>(
          firstHost,
          "host:createRoom",
          { maxPlayers: 4 },
        );

      expect(throttledAck.ok).toBe(false);
      expect(throttledAck.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
      expect(throttledAck.message).toBe(
        "Too many host lifecycle attempts for this app. Please try again.",
      );
    });
  });

  describe("controller join limits", () => {
    const harness = setupServerTestHarness({
      server: {
        authService: {
          verifyHostBootstrap: async ({ appId }: { appId?: string }) => ({
            isVerified: true,
            appId,
            verifiedVia: "appId" as const,
          }),
        } as AuthService,
        rateLimitWindowMs: 60_000,
        hostRegistrationRateLimitMax: 10,
        controllerJoinRateLimitMax: 1,
      },
    });

    it("rate limits repeated controller:join calls from the same socket", async () => {
      const host = await harness.connectSocket();
      const controller = await harness.connectSocket();
      const bootstrapAck = await harness.bootstrapHost(host);
      expect(bootstrapAck.ok).toBe(true);

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
