import { describe, expect, it } from "vitest";
import {
  resolveAuthBaseUrl,
  resolveAuthTrustedOrigins,
} from "./auth-origin-config";

describe("resolveAuthBaseUrl", () => {
  it("prefers BETTER_AUTH_URL when configured", () => {
    expect(
      resolveAuthBaseUrl({
        BETTER_AUTH_URL: "https://airjam.io",
        NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: "https://airjam.io",
      }),
    ).toBe("https://airjam.io");
  });

  it("falls back to the platform public URL", () => {
    expect(
      resolveAuthBaseUrl({
        NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: "https://airjam.io",
      }),
    ).toBe("https://airjam.io");
  });
});

describe("resolveAuthTrustedOrigins", () => {
  it("collects the base url, public host, and explicit trusted origins", () => {
    expect(
      resolveAuthTrustedOrigins({
        BETTER_AUTH_URL: "https://airjam.io",
        NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: "https://airjam.io",
        BETTER_AUTH_TRUSTED_ORIGINS:
          "https://preview.airjam.io, https://airjam.io",
      }),
    ).toEqual(["https://airjam.io", "https://preview.airjam.io"]);
  });

  it("includes the deployment url when explicit hosts are absent", () => {
    expect(
      resolveAuthTrustedOrigins({
        VERCEL_URL: "airjam-git-main-timvucina.vercel.app",
      }),
    ).toEqual(["https://airjam-git-main-timvucina.vercel.app"]);
  });
});
