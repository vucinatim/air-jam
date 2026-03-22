import { afterEach, describe, expect, it } from "vitest";
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

describe("AuthService", () => {
  it("accepts missing API key when AIR_JAM_AUTH_MODE=disabled", async () => {
    process.env.AIR_JAM_AUTH_MODE = "disabled";
    delete process.env.AIR_JAM_MASTER_KEY;

    const authService = new AuthService();
    const result = await authService.verifyApiKey();

    expect(result).toEqual({ isVerified: true });
  });

  it("rejects missing API key when AIR_JAM_AUTH_MODE=required", async () => {
    process.env.AIR_JAM_AUTH_MODE = "required";
    delete process.env.AIR_JAM_MASTER_KEY;

    const authService = new AuthService();
    const result = await authService.verifyApiKey();

    expect(result.isVerified).toBe(false);
    expect(result.error).toBe("Unauthorized: Invalid or Missing API Key");
  });

  it("accepts configured master key in required mode", async () => {
    process.env.AIR_JAM_AUTH_MODE = "required";
    process.env.AIR_JAM_MASTER_KEY = "master-key";

    const authService = new AuthService();
    const result = await authService.verifyApiKey("master-key");

    expect(result).toEqual({ isVerified: true });
  });

  it("defaults to disabled auth in development even when DATABASE_URL is set", async () => {
    delete process.env.AIR_JAM_AUTH_MODE;
    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = "postgres://example";

    const authService = new AuthService();
    const result = await authService.verifyApiKey();

    expect(result).toEqual({ isVerified: true });
  });

  it("defaults to required auth in production when mode is not set", async () => {
    delete process.env.AIR_JAM_AUTH_MODE;
    process.env.NODE_ENV = "production";
    delete process.env.AIR_JAM_MASTER_KEY;
    delete process.env.DATABASE_URL;

    const authService = new AuthService();
    const result = await authService.verifyApiKey();

    expect(result.isVerified).toBe(false);
    expect(result.error).toBe("Unauthorized: Invalid or Missing API Key");
  });
});
