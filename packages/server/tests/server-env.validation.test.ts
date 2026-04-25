import { EnvValidationError } from "@air-jam/env";
import { describe, expect, it } from "vitest";
import { loadServerEnv } from "../src/env/server-env";

describe("loadServerEnv", () => {
  it("fails with an env validation error when required auth mode has no backend", () => {
    expect(() =>
      loadServerEnv({
        AIR_JAM_AUTH_MODE: "required",
        NODE_ENV: "production",
      }),
    ).toThrow(EnvValidationError);
  });

  it("fails when rate limit env expects a positive integer", () => {
    expect(() =>
      loadServerEnv({
        AIR_JAM_RATE_LIMIT_WINDOW_MS: "abc",
      }),
    ).toThrow(EnvValidationError);
  });

  it("returns parsed defaults when optional values are omitted", () => {
    const config = loadServerEnv({
      AIR_JAM_AUTH_MODE: "disabled",
    });

    expect(config.port).toBe(4000);
    expect(config.allowedOrigins).toBe("*");
    expect(config.rateLimitWindowMs).toBe(60_000);
    expect(config.authMode).toBe("disabled");
    expect(config.proxyHeaderTrustMode).toBe("auto");
    expect(config.remoteDatabaseBlocked).toBe(false);
  });

  it("blocks a non-local database url by default outside production", () => {
    const config = loadServerEnv({
      AIR_JAM_AUTH_MODE: "disabled",
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://user:pass@db.example.com:5432/airjam",
    });

    expect(config.databaseUrl).toBeUndefined();
    expect(config.remoteDatabaseBlocked).toBe(true);
  });

  it("allows a non-local database url when explicitly enabled", () => {
    const config = loadServerEnv({
      AIR_JAM_AUTH_MODE: "disabled",
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://user:pass@db.example.com:5432/airjam",
      AIR_JAM_ALLOW_REMOTE_DATABASE: "enabled",
    });

    expect(config.databaseUrl).toBe(
      "postgresql://user:pass@db.example.com:5432/airjam",
    );
    expect(config.remoteDatabaseBlocked).toBe(false);
  });

  it("fails when required auth depends on a blocked non-local database url", () => {
    expect(() =>
      loadServerEnv({
        AIR_JAM_AUTH_MODE: "required",
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://user:pass@db.example.com:5432/airjam",
      }),
    ).toThrow(EnvValidationError);
  });
});
