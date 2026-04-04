import {
  createHostedReleaseArtifactManifest,
  isHostedReleaseSpaFallbackPath,
} from "@/lib/releases/hosted-release-artifact";
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
      resolveReleaseArchiveRoot([
        "index.html",
        ".airjam/release-manifest.json",
        "assets/app.js",
      ]),
    ).toEqual({
      entryPath: "index.html",
      wrapperDirectory: null,
    });
  });

  it("accepts a single wrapper directory", () => {
    expect(
      resolveReleaseArchiveRoot([
        "dist/index.html",
        "dist/.airjam/release-manifest.json",
        "dist/assets/app.js",
      ]),
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

describe("hosted release manifest contract", () => {
  it("builds the fixed hosted release manifest", () => {
    expect(createHostedReleaseArtifactManifest()).toEqual({
      schemaVersion: 1,
      kind: "airjam-hosted-release",
      routes: {
        host: "/",
        controller: "/controller",
      },
    });
  });
});

describe("isHostedReleaseSpaFallbackPath", () => {
  it("serves the controller route through the SPA entry", () => {
    expect(isHostedReleaseSpaFallbackPath("controller")).toBe(true);
    expect(isHostedReleaseSpaFallbackPath("controller/room")).toBe(true);
  });

  it("does not rewrite real assets", () => {
    expect(isHostedReleaseSpaFallbackPath("assets/app.js")).toBe(false);
    expect(isHostedReleaseSpaFallbackPath("favicon.ico")).toBe(false);
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
