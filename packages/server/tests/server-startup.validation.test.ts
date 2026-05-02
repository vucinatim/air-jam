import { EnvValidationError } from "@air-jam/env";
import { afterEach, describe, expect, it } from "vitest";
import { createAirJamServer } from "../src/index";

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

describe("createAirJamServer startup validation", () => {
  it("fails fast when required auth has no configured backend", () => {
    process.env.AIR_JAM_AUTH_MODE = "required";
    delete process.env.DATABASE_URL;
    delete process.env.AIR_JAM_MASTER_KEY;
    delete process.env.AIR_JAM_HOST_GRANT_SECRET;

    expect(() => createAirJamServer()).toThrow(EnvValidationError);
  });
});
