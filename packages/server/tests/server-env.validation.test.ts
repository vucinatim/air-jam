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

  it.each(["production", "preview"] as const)(
    "does not accept AIR_JAM_MASTER_KEY as a hosted %s auth backend",
    (operationalEnvironment) => {
      expect(() =>
        loadServerEnv({
          AIR_JAM_AUTH_MODE: "required",
          AIR_JAM_MASTER_KEY: "legacy-shared-key",
          AIRJAM_OPERATIONAL_ENVIRONMENT: operationalEnvironment,
          NODE_ENV: "production",
        }),
      ).toThrow(EnvValidationError);
    },
  );

  it("preserves explicit local-development master-key auth", () => {
    const config = loadServerEnv({
      AIR_JAM_AUTH_MODE: "required",
      AIR_JAM_MASTER_KEY: "local-development-key",
      AIRJAM_OPERATIONAL_ENVIRONMENT: "development",
      NODE_ENV: "development",
    });

    expect(config.masterKey).toBe("local-development-key");
  });

  it.each(["production", "preview", "development", "test"] as const)(
    "rejects a grant-secret-only backend in %s before runtime startup",
    (operationalEnvironment) => {
      try {
        loadServerEnv({
          AIR_JAM_AUTH_MODE: "required",
          AIR_JAM_HOST_GRANT_SECRET: "grant-signing-secret",
          AIRJAM_OPERATIONAL_ENVIRONMENT: operationalEnvironment,
          NODE_ENV:
            operationalEnvironment === "production" ||
            operationalEnvironment === "preview"
              ? "production"
              : operationalEnvironment,
        });
        expect.fail("Expected the missing database to fail env validation");
      } catch (error) {
        expect(error).toBeInstanceOf(EnvValidationError);
        expect((error as EnvValidationError).issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              envKey: "AIR_JAM_AUTH_MODE",
              message: expect.stringContaining("requires DATABASE_URL"),
              fix: expect.stringContaining(
                "Hosted required auth needs DATABASE_URL",
              ),
            }),
          ]),
        );
      }
    },
  );

  it.each(["production", "preview"] as const)(
    "accepts database-backed %s grants",
    (operationalEnvironment) => {
      const config = loadServerEnv({
        AIR_JAM_AUTH_MODE: "required",
        AIR_JAM_HOST_GRANT_SECRET: "grant-signing-secret",
        DATABASE_URL: "postgresql://user:pass@db.example.com:5432/airjam",
        AIRJAM_OPERATIONAL_ENVIRONMENT: operationalEnvironment,
        NODE_ENV: "production",
      });
      expect(config.databaseUrl).toBe(
        "postgresql://user:pass@db.example.com:5432/airjam",
      );
      expect(config.hostGrantSecret).toBe("grant-signing-secret");
    },
  );

  it("does not let a signing secret bypass the remote database policy", () => {
    expect(() =>
      loadServerEnv({
        AIR_JAM_AUTH_MODE: "required",
        AIR_JAM_HOST_GRANT_SECRET: "grant-signing-secret",
        DATABASE_URL: "postgresql://user:pass@db.example.com:5432/airjam",
        NODE_ENV: "development",
      }),
    ).toThrow(EnvValidationError);
  });

  it("uses the same inferred hosted environment for validation and returned master-key authority", () => {
    expect(() =>
      loadServerEnv({
        AIR_JAM_AUTH_MODE: "required",
        AIR_JAM_MASTER_KEY: "must-not-be-hosted-authority",
        RAILWAY_ENVIRONMENT_NAME: "air-jam-pr-106",
        NODE_ENV: "development",
      }),
    ).toThrow(EnvValidationError);
  });

  it("preserves an explicit local test master key even when a grant secret is configured", () => {
    expect(
      loadServerEnv({
        AIR_JAM_AUTH_MODE: "required",
        AIR_JAM_MASTER_KEY: "local-test-key",
        AIR_JAM_HOST_GRANT_SECRET: "grant-signing-secret",
        NODE_ENV: "test",
      }).masterKey,
    ).toBe("local-test-key");
  });

  it("does not let an operational test label enable a master key in a production process", () => {
    expect(() =>
      loadServerEnv({
        AIR_JAM_AUTH_MODE: "required",
        AIR_JAM_MASTER_KEY: "legacy-shared-key",
        AIRJAM_OPERATIONAL_ENVIRONMENT: "test",
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
    expect(config.runtimeErrorReportRateLimitMax).toBe(30);
    expect(config.authMode).toBe("disabled");
    expect(config.proxyHeaderTrustMode).toBe("auto");
    expect(config.remoteDatabaseBlocked).toBe(false);
    expect(config.operationalBudgetRequirement).toBe("not_applicable");
  });

  it("validates the hosted-runtime report rate limit", () => {
    expect(() =>
      loadServerEnv({
        AIR_JAM_AUTH_MODE: "disabled",
        AIR_JAM_RUNTIME_ERROR_REPORT_RATE_LIMIT_MAX: "0",
      }),
    ).toThrow(EnvValidationError);

    expect(
      loadServerEnv({
        AIR_JAM_AUTH_MODE: "disabled",
        AIR_JAM_RUNTIME_ERROR_REPORT_RATE_LIMIT_MAX: "12",
      }).runtimeErrorReportRateLimitMax,
    ).toBe(12);
  });

  it("accepts a partial app-local env file shape", () => {
    const config = loadServerEnv({
      AIR_JAM_AUTH_MODE: "disabled",
      DATABASE_URL: "",
    });

    expect(config.authMode).toBe("disabled");
    expect(config.databaseUrl).toBeUndefined();
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

  it("forces allowedOrigins='*' on Railway PR preview environments", () => {
    // Production AIR_JAM_ALLOWED_ORIGINS gets cloned into PR envs by
    // Railway; the server must ignore the inherited prod value so
    // socket.io from the sibling preview platform isn't blocked.
    const config = loadServerEnv({
      AIR_JAM_AUTH_MODE: "disabled",
      AIR_JAM_ALLOWED_ORIGINS: "https://airjam.io",
      RAILWAY_ENVIRONMENT_NAME: "air-jam-pr-42",
    });

    expect(config.allowedOrigins).toBe("*");
    expect(config.operationalBudgetRequirement).toBe("not_applicable");
  });

  it("respects AIR_JAM_ALLOWED_ORIGINS on Railway production", () => {
    const config = loadServerEnv({
      AIR_JAM_AUTH_MODE: "disabled",
      AIR_JAM_ALLOWED_ORIGINS: "https://airjam.io",
      RAILWAY_ENVIRONMENT_NAME: "production",
    });

    expect(config.allowedOrigins).toEqual(["https://airjam.io"]);
    expect(config.operationalBudgetRequirement).toBe("required");
  });

  it("preserves leading-subdomain origin patterns in production", () => {
    const config = loadServerEnv({
      AIR_JAM_AUTH_MODE: "disabled",
      AIR_JAM_ALLOWED_ORIGINS: "https://airjam.io,https://*.vercel.app",
      RAILWAY_ENVIRONMENT_NAME: "production",
    });

    expect(config.allowedOrigins).toEqual([
      "https://airjam.io",
      "https://*.vercel.app",
    ]);
  });
});
