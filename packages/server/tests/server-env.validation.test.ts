import { describe, expect, it } from "vitest";
import { loadServerEnv } from "../src/env/server-env";

describe("standalone server environment", () => {
  it("starts from generic local defaults without product configuration", () => {
    const environment = loadServerEnv({});
    expect(environment).toMatchObject({
      port: 4000,
      authMode: "disabled",
      allowedOrigins: "*",
    });
    expect(environment).not.toHaveProperty("databaseUrl");
    expect(environment).not.toHaveProperty("operationalBudgetRequirement");
  });

  it("does not consume a product database inherited by local tooling", () => {
    expect(
      loadServerEnv({ DATABASE_URL: "postgresql://unrelated.invalid/product" }),
    ).not.toHaveProperty("databaseUrl");
  });

  it("defaults production to required auth and excludes local master keys", () => {
    expect(
      loadServerEnv({
        NODE_ENV: "production",
        AIR_JAM_MASTER_KEY: "local-key",
      }),
    ).toMatchObject({ authMode: "required", masterKey: undefined });
  });

  it("retains configured origins instead of applying provider preview policy", () => {
    expect(
      loadServerEnv({
        RAILWAY_ENVIRONMENT_NAME: "pr-123",
        AIR_JAM_ALLOWED_ORIGINS: "https://example.test",
      }).allowedOrigins,
    ).toEqual(["https://example.test"]);
  });

  it("rejects invalid auth configuration", () => {
    expect(() => loadServerEnv({ AIR_JAM_AUTH_MODE: "maybe" })).toThrow();
  });
});
