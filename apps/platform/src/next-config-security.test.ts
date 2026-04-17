import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("platform security headers", () => {
  it("applies baseline security headers to all routes", async () => {
    const headers = await nextConfig.headers?.();
    expect(headers).toBeDefined();

    const globalEntry = headers?.find((entry) => entry.source === "/:path*");
    expect(globalEntry).toBeDefined();

    const byKey = new Map(
      (globalEntry?.headers ?? []).map((header) => [header.key, header.value]),
    );

    // Clickjacking protection — platform routes are only frameable same-origin.
    expect(byKey.get("X-Frame-Options")).toBe("SAMEORIGIN");

    // Content-type sniffing + referrer hardening.
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");

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

    // Frame ancestors stay same-origin so the platform can still embed itself
    // but cannot be reframed by untrusted third parties.
    expect(csp).toContain("frame-ancestors 'self'");

    // Default deny-ish baseline.
    expect(csp).toContain("default-src 'self'");
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
});
