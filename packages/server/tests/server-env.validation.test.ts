import { describe, expect, it } from "vitest";
import { EnvValidationError } from "@air-jam/env";
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
  });
});
