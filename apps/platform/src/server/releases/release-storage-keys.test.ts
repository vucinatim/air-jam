import { describe, expect, it } from "vitest";
import {
  buildReleaseGenerationScreenshotObjectKey,
  buildReleaseGenerationScreenshotRootKey,
  buildReleaseGenerationSiteRootKey,
  buildReleaseGenerationStorageKeys,
  buildReleaseSiteObjectKey,
} from "./release-storage-keys";

describe("immutable release storage keys", () => {
  it("scopes source uploads to one release generation", () => {
    expect(
      buildReleaseGenerationStorageKeys({
        gameId: "game-1",
        releaseId: "release-1",
        generationId: "generation-1",
      }),
    ).toEqual({
      generationRootKey:
        "games/game-1/releases/release-1/generations/generation-1",
      zipObjectKey:
        "games/game-1/releases/release-1/generations/generation-1/source/artifact.zip",
    });
  });

  it("gives every extracted output and screenshot an immutable identity", () => {
    const siteRoot = buildReleaseGenerationSiteRootKey({
      gameId: "game-1",
      releaseId: "release-1",
      generationId: "generation-1",
      outputId: "output-1",
    });
    expect(siteRoot).toBe(
      "games/game-1/releases/release-1/generations/generation-1/outputs/output-1/site",
    );
    expect(buildReleaseSiteObjectKey(siteRoot, "/assets/app.js")).toBe(
      `${siteRoot}/assets/app.js`,
    );
    expect(
      buildReleaseGenerationScreenshotObjectKey({
        gameId: "game-1",
        releaseId: "release-1",
        generationId: "generation-1",
        captureId: "capture-1",
      }),
    ).toBe(
      "games/game-1/releases/release-1/generations/generation-1/screenshots/capture-1/capture.png",
    );
    expect(
      buildReleaseGenerationScreenshotRootKey({
        gameId: "game-1",
        releaseId: "release-1",
        generationId: "generation-1",
        captureId: "capture-1",
      }),
    ).toBe(
      "games/game-1/releases/release-1/generations/generation-1/screenshots/capture-1",
    );
  });
});
