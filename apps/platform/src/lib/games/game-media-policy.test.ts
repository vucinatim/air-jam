import { describe, expect, it } from "vitest";
import { buildGameMediaUrl } from "./game-media-url";
import {
  normalizeGameMediaKindPath,
  parseGameMediaKindPath,
} from "./game-media-policy";

describe("game media path contract", () => {
  it("normalizes preview video to the public route segment", () => {
    expect(normalizeGameMediaKindPath("preview_video")).toBe("preview-video");
    expect(normalizeGameMediaKindPath("thumbnail")).toBe("thumbnail");
  });

  it("parses media route segments back into internal kinds", () => {
    expect(parseGameMediaKindPath("thumbnail")).toBe("thumbnail");
    expect(parseGameMediaKindPath("cover")).toBe("cover");
    expect(parseGameMediaKindPath("preview-video")).toBe("preview_video");
    expect(parseGameMediaKindPath("unknown")).toBeNull();
  });

  it("builds stable public media URLs", () => {
    expect(
      buildGameMediaUrl({
        gameId: "game-123",
        kind: "thumbnail",
      }),
    ).toBe("/media/g/game-123/thumbnail");

    expect(
      buildGameMediaUrl({
        gameId: "game-123",
        kind: "preview_video",
      }),
    ).toBe("/media/g/game-123/preview-video");
  });
});
