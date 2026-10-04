import { EnvValidationError } from "@air-jam/env";
import { afterEach, describe, expect, it } from "vitest";
import { loadReleaseModerationEnv } from "./release-env";
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

const configureIsolatedReleaseOrigin = (): void => {
  delete process.env.RAILWAY_ENVIRONMENT_NAME;
  delete process.env.RAILWAY_PUBLIC_DOMAIN;
  delete process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST;
  delete process.env.BETTER_AUTH_URL;
  delete process.env.BETTER_AUTH_TRUSTED_ORIGINS;
  process.env.NEXT_PUBLIC_APP_URL = "https://airjam.io";
  process.env.AIRJAM_RELEASES_PUBLIC_ORIGIN = "https://airjamusercontent.net";
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
    process.env.AIRJAM_RELEASES_R2_SESSION_TOKEN = "session";

    const config = getReleaseStorageConfig();

    expect(config.bucket).toBe("bucket");
    expect(config.endpoint).toBe("https://account-1.r2.cloudflarestorage.com");
    expect(config.sessionToken).toBe("session");
    expect(config.uploadUrlTtlSeconds).toBe(900);
  });

  it("reports moderation as unavailable when browser runtime is not configured", () => {
    delete process.env.AIRJAM_RELEASES_BROWSER_ACCOUNT_ID;
    delete process.env.AIRJAM_RELEASES_BROWSER_API_TOKEN;

    const availability = getReleaseModerationAvailability();

    expect(availability.available).toBe(false);
    if (!availability.available) {
      expect(availability.reason).toContain(
        "AIRJAM_RELEASES_BROWSER_ACCOUNT_ID",
      );
    }
  });

  it("fails fast for invalid moderation integer env values", () => {
    configureIsolatedReleaseOrigin();
    process.env.AIRJAM_RELEASES_BROWSER_ACCOUNT_ID =
      "0123456789abcdef0123456789abcdef";
    process.env.AIRJAM_RELEASES_BROWSER_API_TOKEN = "browser-token";
    process.env.AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN = "token";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.AIRJAM_RELEASES_BROWSER_VIEWPORT_WIDTH = "invalid";

    expect(() => getReleaseModerationAvailability()).toThrow(
      EnvValidationError,
    );
  });

  it("reports moderation as unavailable when a browser API token is missing", () => {
    process.env.AIRJAM_RELEASES_BROWSER_ACCOUNT_ID =
      "0123456789abcdef0123456789abcdef";
    process.env.AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN = "token";
    process.env.OPENAI_API_KEY = "openai-key";
    delete process.env.AIRJAM_RELEASES_BROWSER_API_TOKEN;

    const availability = getReleaseModerationAvailability();

    expect(availability.available).toBe(false);
    if (!availability.available) {
      expect(availability.reason).toContain(
        "AIRJAM_RELEASES_BROWSER_API_TOKEN",
      );
    }
  });

  it("parses moderation configuration when required values are present", () => {
    configureIsolatedReleaseOrigin();
    process.env.AIRJAM_RELEASES_BROWSER_ACCOUNT_ID =
      "0123456789abcdef0123456789abcdef";
    process.env.AIRJAM_RELEASES_BROWSER_API_TOKEN = "browser-token";
    process.env.AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN = "token";
    process.env.OPENAI_API_KEY = "openai-key";

    const availability = getReleaseModerationAvailability();

    expect(availability.available).toBe(true);
    if (availability.available) {
      expect(availability.config.imageModeration.mode).toBe("openai");
      expect(availability.config.imageModeration.openAi?.model).toBe(
        "omni-moderation-latest",
      );
      expect(availability.config.browser.viewportWidth).toBe(1440);
      expect(availability.config.browser.apiToken).toBe("browser-token");
      expect(availability.config.internalAccessSecret).toBe("token");
    }
  });

  it("parses capture-only moderation configuration without OpenAI", () => {
    configureIsolatedReleaseOrigin();
    process.env.AIRJAM_RELEASES_BROWSER_ACCOUNT_ID =
      "0123456789abcdef0123456789abcdef";
    process.env.AIRJAM_RELEASES_BROWSER_API_TOKEN = "browser-token";
    process.env.AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN = "token";
    process.env.AIRJAM_RELEASES_IMAGE_MODERATION_MODE = "disabled";
    delete process.env.OPENAI_API_KEY;

    const availability = getReleaseModerationAvailability();

    expect(availability.available).toBe(true);
    if (availability.available) {
      expect(availability.config.imageModeration).toEqual({
        mode: "disabled",
        openAi: null,
      });
    }
  });

  it("does not accept a local executable as an alternative to managed isolation", () => {
    delete process.env.AIRJAM_RELEASES_BROWSER_ACCOUNT_ID;
    process.env.AIRJAM_RELEASES_BROWSER_EXECUTABLE_PATH = "/tmp/chrome";
    expect(getReleaseModerationAvailability()).toMatchObject({
      available: false,
      reason: expect.stringContaining("AIRJAM_RELEASES_BROWSER_ACCOUNT_ID"),
    });
  });

  const captureEnv = {
    AIRJAM_RELEASES_BROWSER_ACCOUNT_ID: "0123456789abcdef0123456789abcdef",
    AIRJAM_RELEASES_BROWSER_API_TOKEN: "worker-token",
    AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN: "inspection-secret",
    AIRJAM_RELEASES_IMAGE_MODERATION_MODE: "disabled",
  };

  it.each([
    ["AIRJAM_RELEASES_BROWSER_ACCOUNT_ID", ""],
    ["AIRJAM_RELEASES_BROWSER_API_TOKEN", " "],
    ["AIRJAM_RELEASES_BROWSER_ACCOUNT_ID", "invalid"],
    ["AIRJAM_RELEASES_BROWSER_ACCOUNT_ID", "0123456789abcdef"],
    ["AIRJAM_RELEASES_BROWSER_ACCOUNT_ID", "g".repeat(32)],
    ["AIRJAM_RELEASES_BROWSER_ACCOUNT_ID", "A".repeat(32)],
    ["AIRJAM_RELEASES_BROWSER_NAVIGATION_TIMEOUT_MS", "30001"],
    ["AIRJAM_RELEASES_BROWSER_WAIT_AFTER_LOAD_MS", "10001"],
    ["AIRJAM_RELEASES_BROWSER_VIEWPORT_WIDTH", "2561"],
    ["AIRJAM_RELEASES_BROWSER_VIEWPORT_HEIGHT", "1441"],
    ["AIRJAM_RELEASES_BROWSER_VIEWPORT_WIDTH", "1440junk"],
    ["AIRJAM_RELEASES_BROWSER_VIEWPORT_WIDTH", "1440.5"],
    ["AIRJAM_RELEASES_BROWSER_VIEWPORT_WIDTH", "0"],
  ])("rejects invalid capture setting %s=%s", (key, value) => {
    expect(() =>
      loadReleaseModerationEnv({ ...captureEnv, [key]: value }),
    ).toThrow(EnvValidationError);
  });

  it("accepts the supported capture maxima with required provider credentials", () => {
    expect(
      loadReleaseModerationEnv({
        ...captureEnv,
        AIRJAM_RELEASES_BROWSER_NAVIGATION_TIMEOUT_MS: "30000",
        AIRJAM_RELEASES_BROWSER_WAIT_AFTER_LOAD_MS: "10000",
        AIRJAM_RELEASES_BROWSER_VIEWPORT_WIDTH: "2560",
        AIRJAM_RELEASES_BROWSER_VIEWPORT_HEIGHT: "1440",
      }).browser,
    ).toEqual({
      accountId: captureEnv.AIRJAM_RELEASES_BROWSER_ACCOUNT_ID,
      apiToken: "worker-token",
      navigationTimeoutMs: 30000,
      waitAfterLoadMs: 10000,
      viewportWidth: 2560,
      viewportHeight: 1440,
    });
  });
});
