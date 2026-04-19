import { describe, expect, it } from "vitest";
import nextConfig, { createPlatformSecurityHeaders } from "../next.config";

const toHeaderMap = (headers: { key: string; value: string }[]) =>
  new Map(headers.map((header) => [header.key, header.value]));

describe("platform security headers", () => {
  it("applies baseline security headers to all routes", async () => {
    const headers = await nextConfig.headers?.();
    expect(headers).toBeDefined();

    const globalEntry = headers?.find((entry) => entry.source === "/:path*");
    expect(globalEntry).toBeDefined();

    const byKey = toHeaderMap(globalEntry?.headers ?? []);

    // Content-type sniffing + referrer hardening.
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );

    // Permissions-Policy locks down sensor APIs the platform does not use.
    const permissionsPolicy = byKey.get("Permissions-Policy") ?? "";
    expect(permissionsPolicy).toContain("camera=()");
    expect(permissionsPolicy).toContain("microphone=()");
    expect(permissionsPolicy).toContain("geolocation=()");

    // CSP: enforce the embed-model contract. Rather than pinning the exact
    // string, assert the directives that matter for the product so the CSP
    // can evolve (e.g., to tighten script-src) without rewriting this test
    // every time.
    const csp = byKey.get("Content-Security-Policy") ?? "";

    // Default deny-ish baseline.
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src[^;]*https:\/\/cloud\.umami\.is/);
    expect(csp).toMatch(/script-src[^;]*https:\/\/va\.vercel-scripts\.com/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");

    // Runtime needs: games connect to the realtime server over wss/ws, may
    // load https media, and may be iframed from any https origin (hosted
    // release + managed media).
    expect(csp).toContain("connect-src");
    expect(csp).toMatch(/connect-src[^;]*wss:/);
    expect(csp).toMatch(/img-src[^;]*https:/);
    expect(csp).toMatch(/frame-src[^;]*https:/);
  });

  it("keeps production platform routes frameable only by same-origin ancestors", () => {
    const byKey = toHeaderMap(
      createPlatformSecurityHeaders({ allowInsecureDevFrames: false }),
    );
    const csp = byKey.get("Content-Security-Policy") ?? "";

    expect(byKey.get("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(csp).not.toMatch(/frame-ancestors[^;]*http:/);
  });

  it("allows non-production local Arcade embeds across localhost and LAN origins", () => {
    const byKey = toHeaderMap(
      createPlatformSecurityHeaders({ allowInsecureDevFrames: true }),
    );
    const csp = byKey.get("Content-Security-Policy") ?? "";

    expect(byKey.get("X-Frame-Options")).toBeUndefined();
    expect(csp).toMatch(/frame-src[^;]*http:/);
    expect(csp).toMatch(/frame-ancestors[^;]*http:/);
  });
});
