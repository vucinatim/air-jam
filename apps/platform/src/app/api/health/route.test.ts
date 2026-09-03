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

describe("platform liveness boundary", () => {
  it("reports process liveness independently from release readiness", async () => {
    const response = GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      service: "platform",
      deployment: {
        provider: "railway",
        environment: "production",
        deploymentId: "deployment-platform",
        revision: "0123456789abcdef",
      },
    });
  });
});
