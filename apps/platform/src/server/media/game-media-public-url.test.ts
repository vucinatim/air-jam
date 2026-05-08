import { describe, expect, it } from "vitest";
import { buildManagedGameMediaUrl } from "./game-media-public-url";

describe("buildManagedGameMediaUrl", () => {
  it("returns an absolute public URL for ready assets", () => {
    const originalPublicHost = process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST;
    process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST = "https://airjam.io";

    expect(
      buildManagedGameMediaUrl({
        gameId: "game-123",
        assetId: "asset-123",
        kind: "thumbnail",
      }),
    ).toBe("https://airjam.io/media/g/game-123/thumbnail");

    if (originalPublicHost === undefined) {
      delete process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST;
    } else {
      process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST = originalPublicHost;
    }
  });

  it("returns null when there is no active asset", () => {
    expect(
      buildManagedGameMediaUrl({
        gameId: "game-123",
        assetId: null,
        kind: "cover",
      }),
    ).toBeNull();
  });

  it("returns a relative URL when no public origin is configured", () => {
    const originalPublicHost = process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST;
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const originalRailwayPublicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
    const originalRailwayEnvironmentName = process.env.RAILWAY_ENVIRONMENT_NAME;
    delete process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.RAILWAY_PUBLIC_DOMAIN;
    delete process.env.RAILWAY_ENVIRONMENT_NAME;

    expect(
      buildManagedGameMediaUrl({
        gameId: "game-123",
        assetId: "asset-123",
        kind: "preview_video",
      }),
    ).toBe("/media/g/game-123/preview-video");

    if (originalPublicHost === undefined) {
      delete process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST;
    } else {
      process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST = originalPublicHost;
    }

    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }

    if (originalRailwayPublicDomain === undefined) {
      delete process.env.RAILWAY_PUBLIC_DOMAIN;
    } else {
      process.env.RAILWAY_PUBLIC_DOMAIN = originalRailwayPublicDomain;
    }

    if (originalRailwayEnvironmentName === undefined) {
      delete process.env.RAILWAY_ENVIRONMENT_NAME;
    } else {
      process.env.RAILWAY_ENVIRONMENT_NAME = originalRailwayEnvironmentName;
    }
  });
});
