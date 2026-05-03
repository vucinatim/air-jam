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
});
