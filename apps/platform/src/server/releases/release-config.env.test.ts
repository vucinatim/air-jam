import { EnvValidationError } from "@air-jam/env";
import { afterEach, describe, expect, it } from "vitest";
import {
  getReleaseModerationAvailability,
  resetReleaseModerationConfigForTests,
} from "./release-moderation-config";
import {
  getReleaseStorageConfig,
  resetReleaseStorageConfigForTests,
} from "./release-storage-config";

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
  resetReleaseStorageConfigForTests();
  resetReleaseModerationConfigForTests();
  resetEnv();
});

describe("release env contracts", () => {
  it("fails fast for invalid release storage configuration", () => {
    process.env.AIRJAM_RELEASES_R2_BUCKET = "bucket";
    process.env.AIRJAM_RELEASES_R2_ACCESS_KEY_ID = "access";
    process.env.AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY = "secret";
    delete process.env.AIRJAM_RELEASES_R2_ENDPOINT;
    delete process.env.AIRJAM_RELEASES_R2_ACCOUNT_ID;

    expect(() => getReleaseStorageConfig()).toThrow(EnvValidationError);
  });

  it("parses release storage configuration", () => {
    process.env.AIRJAM_RELEASES_R2_BUCKET = "bucket";
    process.env.AIRJAM_RELEASES_R2_ACCOUNT_ID = "account-1";
    process.env.AIRJAM_RELEASES_R2_ACCESS_KEY_ID = "access";
    process.env.AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY = "secret";

    const config = getReleaseStorageConfig();

    expect(config.bucket).toBe("bucket");
    expect(config.endpoint).toBe("https://account-1.r2.cloudflarestorage.com");
    expect(config.uploadUrlTtlSeconds).toBe(900);
  });

  it("reports moderation as unavailable when browser runtime is not configured", () => {
    delete process.env.AIRJAM_RELEASES_BROWSER_WS_ENDPOINT;
    delete process.env.AIRJAM_RELEASES_BROWSER_EXECUTABLE_PATH;

    const availability = getReleaseModerationAvailability();

    expect(availability.available).toBe(false);
    if (!availability.available) {
      expect(availability.reason).toContain(
        "AIRJAM_RELEASES_BROWSER_WS_ENDPOINT",
      );
    }
  });

  it("fails fast for invalid moderation integer env values", () => {
    process.env.AIRJAM_RELEASES_BROWSER_EXECUTABLE_PATH = "/tmp/chrome";
    process.env.AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN = "token";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.AIRJAM_RELEASES_BROWSER_VIEWPORT_WIDTH = "invalid";

    expect(() => getReleaseModerationAvailability()).toThrow(
      EnvValidationError,
    );
  });

  it("parses moderation configuration when required values are present", () => {
    process.env.AIRJAM_RELEASES_BROWSER_WS_ENDPOINT = "ws://localhost:9222";
    process.env.AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN = "token";
    process.env.OPENAI_API_KEY = "openai-key";

    const availability = getReleaseModerationAvailability();

    expect(availability.available).toBe(true);
    if (availability.available) {
      expect(availability.config.openAi.model).toBe("omni-moderation-latest");
      expect(availability.config.browserLaunch.viewportWidth).toBe(1440);
      expect(availability.config.internalAccessSecret).toBe("token");
    }
  });
});
