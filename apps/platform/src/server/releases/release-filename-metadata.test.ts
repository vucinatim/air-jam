import { describe, expect, it } from "vitest";
import {
  decodeReleaseFilenameMetadata,
  encodeReleaseFilenameMetadata,
} from "./release-filename-metadata";

describe("release filename metadata", () => {
  it.each(["signal-relay.zip", "café.zip", "游戏.zip"])(
    "round-trips %s through an ASCII-only signed header",
    (filename) => {
      const encoded = encodeReleaseFilenameMetadata(filename);

      expect(encoded).toMatch(/^utf8\.[A-Za-z0-9_-]+$/u);
      expect(decodeReleaseFilenameMetadata(encoded)).toBe(filename);
    },
  );

  it("rejects malformed and non-canonical metadata", () => {
    expect(() => decodeReleaseFilenameMetadata("signal-relay.zip")).toThrow(
      "malformed",
    );
    expect(() => decodeReleaseFilenameMetadata("utf8.YQ==")).toThrow(
      "malformed",
    );
  });
});
