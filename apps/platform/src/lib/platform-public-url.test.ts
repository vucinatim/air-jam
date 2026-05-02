import { describe, expect, it } from "vitest";
import {
  PLATFORM_PUBLIC_URL_FALLBACK,
  resolvePlatformPublicUrl,
} from "./platform-public-url";

describe("resolvePlatformPublicUrl", () => {
  it("prefers the explicit Air Jam public host when present", () => {
    expect(
      resolvePlatformPublicUrl({
        NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: "http://127.0.0.1:3400",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
        VERCEL_URL: "air-jam.app",
      }),
    ).toBe("http://127.0.0.1:3400");
  });

  it("falls back to NEXT_PUBLIC_APP_URL before VERCEL_URL", () => {
    expect(
      resolvePlatformPublicUrl({
        NEXT_PUBLIC_APP_URL: "https://air-jam.example",
        VERCEL_URL: "preview.air-jam.app",
      }),
    ).toBe("https://air-jam.example");
  });

  it("normalizes bare VERCEL_URL values to https origins", () => {
    expect(
      resolvePlatformPublicUrl({
        VERCEL_URL: "preview.air-jam.app",
      }),
    ).toBe("https://preview.air-jam.app");
  });

  it("falls back to localhost when nothing is configured", () => {
    expect(resolvePlatformPublicUrl({})).toBe(PLATFORM_PUBLIC_URL_FALLBACK);
  });
});
