import { describe, expect, it } from "vitest";
import {
  RELEASES_PATH_PREFIX,
  buildHostedReleaseAssetPath,
  normalizeRequestedReleaseAssetPath,
} from "./release-url";

describe("buildHostedReleaseAssetPath", () => {
  it("builds the canonical hosted release route shape", () => {
    expect(
      buildHostedReleaseAssetPath({
        gameId: "game-1",
        releaseId: "release-1",
        assetPath: "index.html",
      }),
    ).toBe(`${RELEASES_PATH_PREFIX}/g/game-1/r/release-1/index.html`);
  });
});

describe("normalizeRequestedReleaseAssetPath", () => {
  it("uses the fallback path when no explicit asset path is provided", () => {
    expect(normalizeRequestedReleaseAssetPath(undefined, "index.html")).toBe(
      "index.html",
    );
  });

  it("rejects traversal segments", () => {
    expect(() =>
      normalizeRequestedReleaseAssetPath(["..", "secret.txt"], "index.html"),
    ).toThrow(/invalid release asset path/i);
  });
});
