import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("platform security headers", () => {
  it("keeps platform routes same-origin frameable only", async () => {
    const headers = await nextConfig.headers?.();
    expect(headers).toBeDefined();

    const globalEntry = headers?.find((entry) => entry.source === "/:path*");
    expect(globalEntry).toBeDefined();

    expect(globalEntry?.headers).toEqual(
      expect.arrayContaining([
        {
          key: "X-Frame-Options",
          value: "SAMEORIGIN",
        },
        {
          key: "Content-Security-Policy",
          value: "frame-ancestors 'self';",
        },
      ]),
    );
  });
});
