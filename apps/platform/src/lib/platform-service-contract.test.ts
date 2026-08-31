import { describe, expect, it } from "vitest";
import {
  isPlatformLivenessPath,
  PLATFORM_LIVENESS_PATH,
  readPlatformDeploymentIdentity,
} from "./platform-service-contract";

describe("platform service contract", () => {
  it("recognizes only the exact liveness path", () => {
    expect(isPlatformLivenessPath(PLATFORM_LIVENESS_PATH)).toBe(true);
    expect(isPlatformLivenessPath("/api/health/")).toBe(false);
    expect(isPlatformLivenessPath("/api/readiness")).toBe(false);
  });

  it("projects provider deployment identity without credentials", () => {
    expect(
      readPlatformDeploymentIdentity({
        RAILWAY_PROJECT_ID: "project-air-jam",
        RAILWAY_ENVIRONMENT_NAME: " production ",
        RAILWAY_DEPLOYMENT_ID: " deployment-platform ",
        RAILWAY_GIT_COMMIT_SHA: " revision-123 ",
      }),
    ).toEqual({
      provider: "railway",
      environment: "production",
      deploymentId: "deployment-platform",
      revision: "revision-123",
    });
  });
});
