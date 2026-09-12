import { AIRJAM_DEV_LOG_EVENTS, createHostGrant } from "@air-jam/sdk/protocol";
import { describe, expect, it, vi } from "vitest";
import type { ServerDatabase } from "../src/db";
import type { ServerLogger } from "../src/logging/logger";
import { AuthService } from "../src/services/auth-service";

const createMockLogger = (): Pick<ServerLogger, "info" | "warn" | "error"> => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

const createGrant = async ({
  secret = "secret_123",
  sessionKind = "system",
  origins = ["https://example.com"],
  iat = Math.floor(Date.now() / 1_000),
  exp = iat + 60,
}: {
  secret?: string;
  sessionKind?: "game" | "system";
  origins?: [string, ...string[]];
  iat?: number;
  exp?: number;
} = {}) =>
  createHostGrant({
    secret,
    claims: {
      jti: crypto.randomUUID(),
      aud: "airjam:realtime",
      appId: "aj_app_demo",
      gameId: "game_demo",
      creatorId: "creator_demo",
      iat,
      exp,
      origins,
      sessionKind,
    },
  });

const createPublicAppDatabase = (): ServerDatabase =>
  ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: "app-id-record",
              gameId: "game_demo",
              creatorId: "creator_demo",
              key: "aj_app_demo",
              allowedOrigins: [],
              isActive: true,
              createdAt: new Date(),
              lastUsedAt: null,
            },
          ],
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {},
      }),
    }),
  }) as unknown as ServerDatabase;

describe("AuthService", () => {
  it("emits canonical startup events for explicitly disabled auth mode", () => {
    const logger = createMockLogger();
    new AuthService({
      logger: logger as unknown as ServerLogger,
      env: { authMode: "disabled" },
    });

    expect(logger.info).toHaveBeenCalledWith(
      { event: AIRJAM_DEV_LOG_EVENTS.auth.modeDisabled },
      "Authentication disabled (set AIR_JAM_AUTH_MODE=required to enforce app identity checks)",
    );
  });

  it("emits a canonical startup warning when required auth has no backend", () => {
    const logger = createMockLogger();
    new AuthService({
      logger: logger as unknown as ServerLogger,
      env: { authMode: "required" },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      { event: AIRJAM_DEV_LOG_EVENTS.auth.backendMissing },
      "Authentication required, but no auth backend is configured (set DATABASE_URL)",
    );
  });

  it("accepts missing app ID when auth is explicitly disabled", async () => {
    const authService = new AuthService({ env: { authMode: "disabled" } });

    await expect(authService.verifyAppId()).resolves.toEqual({
      isVerified: true,
    });
  });

  it("rejects missing app ID when auth is required", async () => {
    const authService = new AuthService({ env: { authMode: "required" } });

    await expect(authService.verifyAppId()).resolves.toEqual({
      isVerified: false,
      error: "Unauthorized: Invalid or Missing App ID",
    });
  });

  it("does not read a master key or auth mode directly from process.env", async () => {
    const previousAuthMode = process.env.AIR_JAM_AUTH_MODE;
    const previousMasterKey = process.env.AIR_JAM_MASTER_KEY;
    process.env.AIR_JAM_AUTH_MODE = "disabled";
    process.env.AIR_JAM_MASTER_KEY = "legacy-process-key";

    try {
      const authService = new AuthService({ env: { authMode: "required" } });
      await expect(
        authService.verifyAppId("legacy-process-key"),
      ).resolves.toEqual({
        isVerified: false,
        error: "Unauthorized: Invalid or Missing App ID",
      });
    } finally {
      if (previousAuthMode === undefined) delete process.env.AIR_JAM_AUTH_MODE;
      else process.env.AIR_JAM_AUTH_MODE = previousAuthMode;
      if (previousMasterKey === undefined)
        delete process.env.AIR_JAM_MASTER_KEY;
      else process.env.AIR_JAM_MASTER_KEY = previousMasterKey;
    }
  });

  it("accepts an explicitly supplied local master key", async () => {
    const authService = new AuthService({
      env: { authMode: "required", masterKey: "local-master-key" },
    });

    await expect(authService.verifyAppId("local-master-key")).resolves.toEqual({
      isVerified: true,
    });
  });

  it.each(["system", "game"] as const)(
    "preserves a requested %s session kind when auth is disabled",
    async (hostSessionKind) => {
      const authService = new AuthService({ env: { authMode: "disabled" } });

      await expect(
        authService.verifyHostBootstrap({ hostSessionKind }),
      ).resolves.toMatchObject({
        isVerified: true,
        verifiedVia: "appId",
        hostSessionKind,
      });
    },
  );

  it("forces a public app ID to game authority in required-auth mode", async () => {
    const authService = new AuthService({
      db: createPublicAppDatabase(),
      env: {
        authMode: "required",
        databaseUrl: "postgresql://local.test/airjam",
      },
    });

    await expect(
      authService.verifyHostBootstrap({
        appId: "aj_app_demo",
        hostSessionKind: "system",
      }),
    ).resolves.toMatchObject({
      isVerified: true,
      appId: "aj_app_demo",
      gameId: "game_demo",
      creatorId: "creator_demo",
      verifiedVia: "appId",
      hostSessionKind: "game",
    });
  });

  it("reports a clear startup configuration error when required auth has no backend", () => {
    const authService = new AuthService({ env: { authMode: "required" } });

    expect(authService.getStartupConfigurationError()).toBe(
      "AIR_JAM_AUTH_MODE=required requires an auth backend. Configure DATABASE_URL for app ID bootstrap and signed host grants.",
    );
  });

  it("rejects signed host grants without PostgreSQL consumption authority", async () => {
    const authService = new AuthService({
      env: { authMode: "required", hostGrantSecret: "secret_123" },
    });
    const hostGrant = await createGrant();

    await expect(
      authService.verifyHostBootstrap({
        hostGrant,
        origin: "https://example.com",
      }),
    ).resolves.toEqual({
      isVerified: false,
      error: "Unauthorized: Host grant consumption is unavailable",
    });
    expect(authService.getStartupConfigurationError()).toBe(
      "Signed host grants require PostgreSQL consumption authority.",
    );
  });

  it("rejects an expired signed host grant", async () => {
    const authService = new AuthService({
      env: { authMode: "required", hostGrantSecret: "secret_123" },
    });
    const now = Math.floor(Date.now() / 1_000);
    const hostGrant = await createGrant({ iat: now - 65, exp: now - 5 });

    const result = await authService.verifyHostBootstrap({
      hostGrant,
      origin: "https://example.com",
    });

    expect(result.isVerified).toBe(false);
    expect(result.error).toBe("Host grant expired");
  });

  it("rejects a signed host grant when the request origin is not allowed", async () => {
    const authService = new AuthService({
      env: { authMode: "required", hostGrantSecret: "secret_123" },
    });
    const hostGrant = await createGrant({
      origins: ["https://allowed.example"],
    });

    const result = await authService.verifyHostBootstrap({
      hostGrant,
      origin: "https://blocked.example",
    });

    expect(result.isVerified).toBe(false);
    expect(result.error).toBe("Unauthorized: Origin not allowed by Host Grant");
  });

  it("does not deny a consumed grant when best-effort cleanup fails", async () => {
    const logger = createMockLogger();
    const database = {
      transaction: vi.fn(async () => ({ status: "consumed" as const })),
      execute: vi.fn(async () => {
        throw new Error("cleanup unavailable");
      }),
    } as unknown as ServerDatabase;
    const authService = new AuthService({
      db: database,
      logger: logger as unknown as ServerLogger,
      env: {
        authMode: "required",
        databaseUrl: "postgresql://local.test/airjam",
        hostGrantSecret: "secret_123",
      },
    });
    const hostGrant = await createGrant({ sessionKind: "game" });

    await expect(
      authService.verifyHostBootstrap({
        hostGrant,
        origin: "https://example.com",
      }),
    ).resolves.toMatchObject({
      isVerified: true,
      hostSessionKind: "game",
    });
    expect(logger.warn).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Expired host grant consumption cleanup failed",
    );
  });
});
