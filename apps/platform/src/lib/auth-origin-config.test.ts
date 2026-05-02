import { describe, expect, it } from "vitest";
import {
  resolveAuthBaseUrl,
  resolveAuthTrustedOrigins,
} from "./auth-origin-config";

describe("resolveAuthBaseUrl", () => {
  it("prefers BETTER_AUTH_URL when configured", () => {
    expect(
      resolveAuthBaseUrl({
        BETTER_AUTH_URL: "https://www.air-jam.app",
        NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: "https://air-jam.app",
      }),
    ).toBe("https://www.air-jam.app");
  });

  it("falls back to the platform public URL", () => {
    expect(
      resolveAuthBaseUrl({
        NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: "https://www.air-jam.app",
      }),
    ).toBe("https://www.air-jam.app");
  });
});

describe("resolveAuthTrustedOrigins", () => {
  it("collects the base url, public host, and explicit trusted origins", () => {
    expect(
      resolveAuthTrustedOrigins({
        BETTER_AUTH_URL: "https://www.air-jam.app",
        NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: "https://air-jam.app",
        BETTER_AUTH_TRUSTED_ORIGINS:
          "https://preview.air-jam.app, https://www.air-jam.app",
      }),
    ).toEqual([
      "https://www.air-jam.app",
      "https://air-jam.app",
      "https://preview.air-jam.app",
    ]);
  });

  it("includes the deployment url when explicit hosts are absent", () => {
    expect(
      resolveAuthTrustedOrigins({
        VERCEL_URL: "airjam-git-main-timvucina.vercel.app",
      }),
    ).toEqual(["https://airjam-git-main-timvucina.vercel.app"]);
  });
});
