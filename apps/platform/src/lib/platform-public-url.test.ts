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
        VERCEL_URL: "airjam.io",
      }),
    ).toBe("http://127.0.0.1:3400");
  });

  it("falls back to NEXT_PUBLIC_APP_URL before VERCEL_URL", () => {
    expect(
      resolvePlatformPublicUrl({
        NEXT_PUBLIC_APP_URL: "https://air-jam.example",
        RAILWAY_PUBLIC_DOMAIN: "platform-preview.up.railway.app",
        VERCEL_URL: "preview.airjam.io",
      }),
    ).toBe("https://air-jam.example");
  });

  it("prefers the Railway public domain inside Railway preview environments", () => {
    expect(
      resolvePlatformPublicUrl({
        RAILWAY_ENVIRONMENT_NAME: "air-jam-pr-17",
        NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST:
          "https://air-jam-platform-production.up.railway.app",
        NEXT_PUBLIC_APP_URL: "https://air-jam-platform-production.up.railway.app",
        RAILWAY_PUBLIC_DOMAIN: "air-jam-platform-air-jam-pr-17.up.railway.app",
      }),
    ).toBe("https://air-jam-platform-air-jam-pr-17.up.railway.app");
  });

  it("falls back to the Railway public domain before Vercel", () => {
    expect(
      resolvePlatformPublicUrl({
        RAILWAY_PUBLIC_DOMAIN: "platform-preview.up.railway.app",
        VERCEL_URL: "preview.airjam.io",
      }),
    ).toBe("https://platform-preview.up.railway.app");
  });

  it("normalizes bare VERCEL_URL values to https origins", () => {
    expect(
      resolvePlatformPublicUrl({
        VERCEL_URL: "preview.airjam.io",
      }),
    ).toBe("https://preview.airjam.io");
  });

  it("falls back to localhost when nothing is configured", () => {
    expect(resolvePlatformPublicUrl({})).toBe(PLATFORM_PUBLIC_URL_FALLBACK);
  });
});
