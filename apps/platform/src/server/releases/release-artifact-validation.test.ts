import { describe, expect, it } from "vitest";
import {
  getReleaseAssetCacheControl,
  normalizeReleaseArchiveEntryPath,
  resolveReleaseArchiveRoot,
} from "./release-artifact-validation";

describe("normalizeReleaseArchiveEntryPath", () => {
  it("normalizes standard archive file paths", () => {
    expect(normalizeReleaseArchiveEntryPath("./dist/index.html")).toEqual({
      archivePath: "dist/index.html",
      isDirectory: false,
    });
  });

  it("rejects path traversal", () => {
    expect(() => normalizeReleaseArchiveEntryPath("../secrets.txt")).toThrow(
      /escapes the allowed root/i,
    );
  });
});

describe("resolveReleaseArchiveRoot", () => {
  it("accepts a root index entry", () => {
    expect(
      resolveReleaseArchiveRoot(["index.html", "assets/app.js"]),
    ).toEqual({
      entryPath: "index.html",
      wrapperDirectory: null,
    });
  });

  it("accepts a single wrapper directory", () => {
    expect(
      resolveReleaseArchiveRoot(["dist/index.html", "dist/assets/app.js"]),
    ).toEqual({
      entryPath: "index.html",
      wrapperDirectory: "dist",
    });
  });

  it("rejects mixed top-level roots", () => {
    expect(() =>
      resolveReleaseArchiveRoot(["dist/index.html", "assets/app.js"]),
    ).toThrow(/single top-level wrapper directory/i);
  });
});

describe("getReleaseAssetCacheControl", () => {
  it("keeps html conservative", () => {
    expect(getReleaseAssetCacheControl("index.html")).toBe("no-cache");
  });

  it("marks immutable static assets long-lived", () => {
    expect(getReleaseAssetCacheControl("assets/app.abc123.js")).toBe(
      "public, max-age=31536000, immutable",
    );
  });
});
