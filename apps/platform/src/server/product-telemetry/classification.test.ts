import { describe, expect, it } from "vitest";
import {
  classifyProductTelemetryActor,
  classifyProductTelemetryPage,
  classifyProductTelemetryReferrer,
  resolveProductTelemetryDeployment,
} from "./classification";

describe("product telemetry classification", () => {
  it("classifies agent, bot, human, and unknown actors without retaining user agents", () => {
    expect(classifyProductTelemetryActor("ClaudeBot/1.0")).toEqual({
      actorClass: "agent",
      agentFamily: "anthropic",
    });
    expect(classifyProductTelemetryActor("Googlebot/2.1")).toEqual({
      actorClass: "bot",
      agentFamily: null,
    });
    expect(
      classifyProductTelemetryActor("Mozilla/5.0 AppleWebKit/537.36"),
    ).toEqual({ actorClass: "human", agentFamily: null });
    expect(classifyProductTelemetryActor(null)).toEqual({
      actorClass: "unknown",
      agentFamily: null,
    });
  });

  it("normalizes known referrers and gives explicit campaigns attribution priority", () => {
    expect(
      classifyProductTelemetryReferrer({
        referrerHost: "www.linkedin.com",
        platformHost: "airjam.io",
      }),
    ).toBe("social");
    expect(
      classifyProductTelemetryReferrer({
        referrerHost: "airjam.io",
        platformHost: "airjam.io",
      }),
    ).toBe("internal");
    expect(
      classifyProductTelemetryReferrer({
        referrerHost: "news.example.com",
        campaignSource: "claude",
        platformHost: "airjam.io",
      }),
    ).toBe("ai");
    expect(
      classifyProductTelemetryReferrer({ platformHost: "airjam.io" }),
    ).toBe("direct");
  });

  it("uses canonical bounded page keys and removes dashboard resource IDs", () => {
    expect(classifyProductTelemetryPage("/Docs/Getting-Started/")).toEqual({
      surface: "docs",
      pageKey: "/docs/getting-started",
    });
    expect(
      classifyProductTelemetryPage("/dashboard/games/01j8example/releases"),
    ).toEqual({
      surface: "dashboard",
      pageKey: "/dashboard/games/:game/releases",
    });
    expect(classifyProductTelemetryPage("/unexpected/private-value")).toEqual({
      surface: "other",
      pageKey: "/other",
    });
  });

  it("labels production, preview, development, and test deployments", () => {
    expect(
      resolveProductTelemetryDeployment({
        NODE_ENV: "production",
        RAILWAY_ENVIRONMENT_NAME: "production",
        RAILWAY_DEPLOYMENT_ID: "Deploy 123",
      }),
    ).toEqual({ environment: "production", deploymentId: "deploy-123" });
    expect(
      resolveProductTelemetryDeployment({
        NODE_ENV: "production",
        RAILWAY_ENVIRONMENT_NAME: "air-jam-pr-42",
      }),
    ).toEqual({ environment: "preview", deploymentId: "air-jam-pr-42" });
    expect(resolveProductTelemetryDeployment({ NODE_ENV: "test" })).toEqual({
      environment: "test",
      deploymentId: "test",
    });
  });
});
