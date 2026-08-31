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
  delete process.env.AIRJAM_RELEASES_PUBLIC_ORIGIN;
});

afterEach(resetEnv);

describe("platform readiness boundary", () => {
  it("fails production readiness when the hosted release origin is unavailable", async () => {
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
      },
    });
  });

  it("passes production readiness only with a cross-site release origin", async () => {
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
      },
    });
  });

  it("fails readiness when runtime platform identity drifts from the built response policy", async () => {
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

  it("keeps preview readiness available while release delivery stays disabled", async () => {
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
