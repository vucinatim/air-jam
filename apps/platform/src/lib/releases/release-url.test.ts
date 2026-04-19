import { describe, expect, it } from "vitest";
import {
  RELEASES_PATH_PREFIX,
  buildHostedReleaseAssetPath,
  buildHostedReleaseBasePath,
  injectHostedReleaseHtmlRuntimeBase,
  logicalHostedReleaseRoutePath,
  normalizeRequestedReleaseAssetPath,
  rewriteHostedReleaseHtmlAssetUrls,
  rewriteHostedReleaseTextAssetUrls,
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

describe("buildHostedReleaseBasePath", () => {
  it("builds the hosted release base route", () => {
    expect(
      buildHostedReleaseBasePath({
        gameId: "game-1",
        releaseId: "release-1",
      }),
    ).toBe(`${RELEASES_PATH_PREFIX}/g/game-1/r/release-1`);
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

describe("rewriteHostedReleaseHtmlAssetUrls", () => {
  it("rewrites root-relative asset urls into the hosted release scope", () => {
    expect(
      rewriteHostedReleaseHtmlAssetUrls({
        html: `
          <link rel="stylesheet" href="/assets/app.css">
          <script type="module" src="/assets/app.js"></script>
          <div style="background-image:url('/assets/bg.png')"></div>
        `,
        gameId: "game-1",
        releaseId: "release-1",
      }),
    ).toContain(`${RELEASES_PATH_PREFIX}/g/game-1/r/release-1/assets/app.css`);
  });

  it("preserves protocol-relative urls", () => {
    expect(
      rewriteHostedReleaseHtmlAssetUrls({
        html: `<script src="//cdn.example.com/app.js"></script>`,
        gameId: "game-1",
        releaseId: "release-1",
      }),
    ).toContain(`src="//cdn.example.com/app.js"`);
  });
});

describe("rewriteHostedReleaseTextAssetUrls", () => {
  it("rewrites root-relative asset urls inside built js and css text", () => {
    const rewritten = rewriteHostedReleaseTextAssetUrls({
      content:
        'const audio="/sounds/bell.mp3";const chunk="/assets/index-abc123.js";const sprite="/sprites/cover.png";const model="/models/arena.glb";body{background:url("/sprites/end.png")}',
      gameId: "game-1",
      releaseId: "release-1",
    });

    expect(rewritten).toContain(
      '"/releases/g/game-1/r/release-1/sounds/bell.mp3"',
    );
    expect(rewritten).toContain(
      '"/releases/g/game-1/r/release-1/assets/index-abc123.js"',
    );
    expect(rewritten).toContain(
      '"/releases/g/game-1/r/release-1/models/arena.glb"',
    );
    expect(rewritten).toContain(
      'url("/releases/g/game-1/r/release-1/sprites/end.png")',
    );
  });

  it("rewrites bare relative Vite chunk asset paths inside built js text", () => {
    const rewritten = rewriteHostedReleaseTextAssetUrls({
      content:
        'const deps=["assets/index-DPOFnepx.js","assets/code-review-store-Jwj-6tv7.js"]',
      gameId: "game-1",
      releaseId: "release-1",
    });

    expect(rewritten).toContain(
      '"releases/g/game-1/r/release-1/assets/index-DPOFnepx.js"',
    );
    expect(rewritten).toContain(
      '"releases/g/game-1/r/release-1/assets/code-review-store-Jwj-6tv7.js"',
    );
  });
});

describe("logicalHostedReleaseRoutePath", () => {
  it("maps the entry path back to the host route", () => {
    expect(
      logicalHostedReleaseRoutePath({
        requestedAssetPath: "index.html",
        entryPath: "index.html",
      }),
    ).toBe("/");
  });

  it("maps non-entry SPA fallback paths back to their app route", () => {
    expect(
      logicalHostedReleaseRoutePath({
        requestedAssetPath: "controller",
        entryPath: "index.html",
      }),
    ).toBe("/controller");
  });
});

describe("injectHostedReleaseHtmlRuntimeBase", () => {
  it("injects the hosted release base href and route bootstrap", () => {
    const rewritten = injectHostedReleaseHtmlRuntimeBase({
      html: "<html><head></head><body><div id='root'></div></body></html>",
      gameId: "game-1",
      releaseId: "release-1",
      requestedAssetPath: "index.html",
      entryPath: "index.html",
    });

    expect(rewritten).toContain(
      `<base href="${RELEASES_PATH_PREFIX}/g/game-1/r/release-1/">`,
    );
    expect(rewritten).toContain(`window.__AIRJAM_HOSTED_RELEASE_ROUTE__="/"`);
  });
});
