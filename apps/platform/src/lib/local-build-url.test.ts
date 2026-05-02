import { describe, expect, it } from "vitest";
import {
  buildLocalBuildBasePath,
  injectLocalBuildHtmlRuntimeBase,
  isLocalBuildSpaFallbackPath,
  normalizeRequestedLocalBuildAssetPath,
  rewriteLocalBuildHtmlAssetUrls,
  rewriteLocalBuildTextAssetUrls,
} from "./local-build-url";

describe("local build url helpers", () => {
  it("builds the scoped local build base path", () => {
    expect(buildLocalBuildBasePath("code-review")).toBe(
      "/airjam-local-builds/code-review",
    );
  });

  it("rewrites root-relative asset urls into the local build scope", () => {
    expect(
      rewriteLocalBuildHtmlAssetUrls({
        html: '<script src="/assets/app.js"></script><link href="/assets/app.css"><div style="background:url(/sprites/cover.png)"></div>',
        gameId: "code-review",
      }),
    ).toContain("/airjam-local-builds/code-review/assets/app.js");
  });

  it("rewrites root-relative asset urls inside built js and css text", () => {
    const rewritten = rewriteLocalBuildTextAssetUrls({
      content:
        'const audio="/sounds/bell.mp3";const chunk="/assets/index-abc123.js";const sprite="/sprites/cover.png";body{background:url("/sprites/end.png")}',
      gameId: "code-review",
    });

    expect(rewritten).toContain(
      '"/airjam-local-builds/code-review/sounds/bell.mp3"',
    );
    expect(rewritten).toContain(
      '"/airjam-local-builds/code-review/assets/index-abc123.js"',
    );
    expect(rewritten).toContain(
      'url("/airjam-local-builds/code-review/sprites/end.png")',
    );
  });

  it("rewrites bare relative Vite chunk asset paths inside built js text", () => {
    const rewritten = rewriteLocalBuildTextAssetUrls({
      content:
        'const deps=["assets/index-DPOFnepx.js","assets/code-review-store-Jwj-6tv7.js"]',
      gameId: "code-review",
    });

    expect(rewritten).toContain(
      '"airjam-local-builds/code-review/assets/index-DPOFnepx.js"',
    );
    expect(rewritten).toContain(
      '"airjam-local-builds/code-review/assets/code-review-store-Jwj-6tv7.js"',
    );
  });

  it("injects the router basename bootstrap and base href", () => {
    const html = injectLocalBuildHtmlRuntimeBase({
      html: "<html><head></head><body></body></html>",
      gameId: "code-review",
    });

    expect(html).toContain(
      'window.__AIRJAM_LOCAL_GAME_PROXY_BASE__="/airjam-local-builds/code-review"',
    );
    expect(html).toContain('<base href="/airjam-local-builds/code-review/">');
  });

  it("normalizes request paths and blocks traversal", () => {
    expect(normalizeRequestedLocalBuildAssetPath(undefined)).toBe("index.html");
    expect(normalizeRequestedLocalBuildAssetPath(["assets", "app.js"])).toBe(
      "assets/app.js",
    );
    expect(() =>
      normalizeRequestedLocalBuildAssetPath(["..", "secret"]),
    ).toThrow(/Invalid local build asset path/);
  });

  it("treats extensionless paths as SPA fallbacks", () => {
    expect(isLocalBuildSpaFallbackPath("controller")).toBe(true);
    expect(isLocalBuildSpaFallbackPath("assets/app.js")).toBe(false);
  });
});
