import { resetReleaseModerationConfigForTests } from "@/server/releases/release-moderation-config";
import { resetReleaseStorageConfigForTests } from "@/server/releases/release-storage-config";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const ORIGINAL_ENV = { ...process.env };

const resetEnv = (): void => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
};

beforeEach(() => {
  process.env.NODE_ENV = "production";
  process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST = "https://airjam.io";
  process.env.RAILWAY_PROJECT_ID = "project-air-jam";
  process.env.RAILWAY_DEPLOYMENT_ID = "deployment-platform";
  process.env.RAILWAY_GIT_COMMIT_SHA = "0123456789abcdef";
  process.env.RAILWAY_ENVIRONMENT_NAME = "production";
  process.env.AIRJAM_RELEASES_R2_BUCKET = "release-bucket";
  process.env.AIRJAM_RELEASES_R2_ACCOUNT_ID = "r2-account";
  process.env.AIRJAM_RELEASES_R2_ACCESS_KEY_ID = "r2-access-key";
  process.env.AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY = "r2-secret-key";
  process.env.AIRJAM_RELEASES_BROWSER_WS_ENDPOINT =
    "wss://browser-worker.example/ws";
  process.env.AIRJAM_RELEASES_BROWSER_ACCESS_TOKEN = "browser-secret";
  process.env.AIRJAM_RELEASES_INTERNAL_ACCESS_TOKEN = "internal-secret";
  process.env.AIRJAM_RELEASES_IMAGE_MODERATION_MODE = "disabled";
  delete process.env.AIRJAM_RELEASES_PUBLIC_ORIGIN;
  resetReleaseStorageConfigForTests();
  resetReleaseModerationConfigForTests();
});

afterEach(() => {
  resetReleaseStorageConfigForTests();
  resetReleaseModerationConfigForTests();
  resetEnv();
});

describe("platform health boundary", () => {
  it("fails production health when the hosted release origin is unavailable", async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      service: "platform",
      deployment: {
        provider: "railway",
        environment: "production",
        deploymentId: "deployment-platform",
        revision: "0123456789abcdef",
      },
      boundaries: {
        hostedReleaseOrigin: {
          required: true,
          status: "disabled",
          publicOrigin: null,
        },
        releaseStorage: { required: true, status: "ready", reason: null },
        releaseModeration: {
          required: true,
          status: "unavailable",
          reason:
            "Release screenshot and moderation processing is unavailable.",
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain("r2-secret-key");
    expect(JSON.stringify(body)).not.toContain("browser-secret");
  });

  it("fails production health when required release storage is invalid", async () => {
    process.env.AIRJAM_RELEASES_PUBLIC_ORIGIN =
      "https://airjamusercontent.example";
    delete process.env.AIRJAM_RELEASES_R2_SECRET_ACCESS_KEY;

    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.boundaries.releaseStorage).toEqual({
      required: true,
      status: "unavailable",
      reason: "Release artifact storage is not configured or invalid.",
    });
  });

  it("passes production health only with a cross-site release origin", async () => {
    process.env.AIRJAM_RELEASES_PUBLIC_ORIGIN =
      "https://airjamusercontent.example";

    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      boundaries: {
        hostedReleaseOrigin: {
          required: true,
          status: "ready",
          publicOrigin: "https://airjamusercontent.example",
          reason: null,
        },
        releaseStorage: { required: true, status: "ready", reason: null },
        releaseModeration: {
          required: true,
          status: "ready",
          reason: null,
        },
      },
    });
  });

  it("fails health when runtime platform identity drifts from the built response policy", async () => {
    process.env.AIRJAM_RELEASES_PUBLIC_ORIGIN =
      "https://airjamusercontent.example";
    process.env.AIRJAM_BUILT_PLATFORM_PUBLIC_ORIGIN =
      "https://previous.airjam.io";

    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      ok: false,
      boundaries: {
        hostedReleaseOrigin: {
          required: true,
          status: "invalid",
          publicOrigin: null,
        },
      },
    });
    expect(body.boundaries.hostedReleaseOrigin.reason).toContain(
      "baked into the release response policy",
    );
  });

  it("keeps preview health available while release delivery stays disabled", async () => {
    process.env.RAILWAY_ENVIRONMENT_NAME = "air-jam-pr-71";

    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      boundaries: {
        hostedReleaseOrigin: {
          required: false,
          status: "disabled",
        },
      },
    });
  });
});
