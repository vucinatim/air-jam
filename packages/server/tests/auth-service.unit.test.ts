import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AIRJAM_DEV_LOG_EVENTS,
  createHostGrant,
} from "@air-jam/sdk/protocol";
import { AuthService } from "../src/services/auth-service";

const ORIGINAL_ENV = { ...process.env };

const resetEnv = (): void => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  Object.assign(process.env, ORIGINAL_ENV);
};

afterEach(() => {
  resetEnv();
});

const createMockLogger = () => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
});

describe("AuthService", () => {
  it("emits canonical startup events for disabled auth mode", () => {
    process.env.AIR_JAM_AUTH_MODE = "disabled";

    const logger = createMockLogger();
    new AuthService({ logger: logger as any });

    expect(logger.info).toHaveBeenCalledWith(
      { event: AIRJAM_DEV_LOG_EVENTS.auth.modeDisabled },
      "Authentication disabled (set AIR_JAM_AUTH_MODE=required to enforce app identity checks)",
    );
  });

  it("emits a canonical startup warning when required auth has no backend", () => {
    process.env.AIR_JAM_AUTH_MODE = "required";
    delete process.env.AIR_JAM_MASTER_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.AIR_JAM_HOST_GRANT_SECRET;

    const logger = createMockLogger();
    new AuthService({ logger: logger as any });

    expect(logger.warn).toHaveBeenCalledWith(
      { event: AIRJAM_DEV_LOG_EVENTS.auth.backendMissing },
      "Authentication required, but no auth backend is configured (set AIR_JAM_MASTER_KEY or DATABASE_URL)",
    );
  });

  it("accepts missing app ID when AIR_JAM_AUTH_MODE=disabled", async () => {
    process.env.AIR_JAM_AUTH_MODE = "disabled";
    delete process.env.AIR_JAM_MASTER_KEY;

    const authService = new AuthService();
    const result = await authService.verifyAppId();

    expect(result).toEqual({ isVerified: true });
  });

  it("rejects missing app ID when AIR_JAM_AUTH_MODE=required", async () => {
    process.env.AIR_JAM_AUTH_MODE = "required";
    delete process.env.AIR_JAM_MASTER_KEY;

    const authService = new AuthService();
    const result = await authService.verifyAppId();

    expect(result.isVerified).toBe(false);
    expect(result.error).toBe("Unauthorized: Invalid or Missing App ID");
  });

  it("accepts configured master key in required mode", async () => {
    process.env.AIR_JAM_AUTH_MODE = "required";
    process.env.AIR_JAM_MASTER_KEY = "master-key";

    const authService = new AuthService();
    const result = await authService.verifyAppId("master-key");

    expect(result).toEqual({ isVerified: true });
  });

  it("defaults to disabled auth in development even when DATABASE_URL is set", async () => {
    delete process.env.AIR_JAM_AUTH_MODE;
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgres://example";

    const authService = new AuthService();
    const result = await authService.verifyAppId();

    expect(result).toEqual({ isVerified: true });
  });

  it("defaults to required auth in production when mode is not set", async () => {
    delete process.env.AIR_JAM_AUTH_MODE;
    process.env.NODE_ENV = "production";
    delete process.env.AIR_JAM_MASTER_KEY;
    delete process.env.DATABASE_URL;

    const authService = new AuthService();
    const result = await authService.verifyAppId();

    expect(result.isVerified).toBe(false);
    expect(result.error).toBe("Unauthorized: Invalid or Missing App ID");
  });

  it("reports a clear startup configuration error when required auth has no backend", () => {
    process.env.AIR_JAM_AUTH_MODE = "required";
    delete process.env.AIR_JAM_MASTER_KEY;
    delete process.env.DATABASE_URL;
    delete process.env.AIR_JAM_HOST_GRANT_SECRET;

    const authService = new AuthService();

    expect(authService.getStartupConfigurationError()).toBe(
      "AIR_JAM_AUTH_MODE=required requires an auth backend. Configure DATABASE_URL for app ID bootstrap, AIR_JAM_HOST_GRANT_SECRET for signed host grants, or AIR_JAM_MASTER_KEY for the legacy fallback.",
    );
  });

  it("accepts a valid signed host grant", async () => {
    process.env.AIR_JAM_AUTH_MODE = "required";
    process.env.AIR_JAM_HOST_GRANT_SECRET = "secret_123";

    const authService = new AuthService();
    const hostGrant = await createHostGrant({
      secret: "secret_123",
      claims: {
        appId: "aj_app_demo",
        exp: Math.floor(Date.now() / 1000) + 60,
        scopes: ["host:bootstrap"],
      },
    });

    const result = await authService.verifyHostBootstrap({
      hostGrant,
      origin: "https://example.com",
    });

    expect(result).toMatchObject({
      isVerified: true,
      appId: "aj_app_demo",
      verifiedVia: "hostGrant",
    });
    expect(result.grantClaims?.appId).toBe("aj_app_demo");
  });

  it("rejects an expired signed host grant", async () => {
    process.env.AIR_JAM_AUTH_MODE = "required";
    process.env.AIR_JAM_HOST_GRANT_SECRET = "secret_123";

    const authService = new AuthService();
    const hostGrant = await createHostGrant({
      secret: "secret_123",
      claims: {
        appId: "aj_app_demo",
        exp: Math.floor(Date.now() / 1000) - 5,
        scopes: ["host:bootstrap"],
      },
    });

    const result = await authService.verifyHostBootstrap({
      hostGrant,
      origin: "https://example.com",
    });

    expect(result.isVerified).toBe(false);
    expect(result.error).toBe("Host grant expired");
  });

  it("rejects a signed host grant when the request origin is not allowed", async () => {
    process.env.AIR_JAM_AUTH_MODE = "required";
    process.env.AIR_JAM_HOST_GRANT_SECRET = "secret_123";

    const authService = new AuthService();
    const hostGrant = await createHostGrant({
      secret: "secret_123",
      claims: {
        appId: "aj_app_demo",
        exp: Math.floor(Date.now() / 1000) + 60,
        scopes: ["host:bootstrap"],
        origins: ["https://allowed.example"],
      },
    });

    const result = await authService.verifyHostBootstrap({
      hostGrant,
      origin: "https://blocked.example",
    });

    expect(result.isVerified).toBe(false);
    expect(result.error).toBe("Unauthorized: Origin not allowed by Host Grant");
  });
});
