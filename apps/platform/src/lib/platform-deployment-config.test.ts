import { describe, expect, it } from "vitest";
import {
  PLATFORM_PUBLIC_URL_FALLBACK,
  resolvePlatformDeploymentConfig,
} from "./platform-deployment-config";

describe("resolvePlatformDeploymentConfig", () => {
  it("resolves the public, backend, and auth urls from explicit env", () => {
    expect(
      resolvePlatformDeploymentConfig({
        NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: "https://preview.airjam.io",
        NEXT_PUBLIC_AIR_JAM_SERVER_URL: "https://api-preview.airjam.io",
        BETTER_AUTH_URL: "https://auth-preview.airjam.io",
      }),
    ).toMatchObject({
      platformPublicUrl: "https://preview.airjam.io",
      backendPublicUrl: "https://api-preview.airjam.io",
      authBaseUrl: "https://auth-preview.airjam.io",
      hasExplicitPlatformPublicOrigin: true,
    });
  });

  it("falls back to the platform public url for backend and auth when explicit values are absent", () => {
    expect(
      resolvePlatformDeploymentConfig({
        NEXT_PUBLIC_APP_URL: "preview.airjam.io",
      }),
    ).toMatchObject({
      platformPublicUrl: "https://preview.airjam.io",
      backendPublicUrl: "https://preview.airjam.io",
      authBaseUrl: "https://preview.airjam.io",
    });
  });

  it("falls back to the Railway public domain when no explicit public host is set", () => {
    expect(
      resolvePlatformDeploymentConfig({
        RAILWAY_PUBLIC_DOMAIN: "platform-production.up.railway.app",
      }),
    ).toMatchObject({
      platformPublicUrl: "https://platform-production.up.railway.app",
      backendPublicUrl: "https://platform-production.up.railway.app",
      authBaseUrl: "https://platform-production.up.railway.app",
      hasExplicitPlatformPublicOrigin: true,
    });
  });

  it("prefers the Railway public domain inside Railway preview environments", () => {
    expect(
      resolvePlatformDeploymentConfig({
        RAILWAY_ENVIRONMENT_NAME: "air-jam-pr-17",
        RAILWAY_PUBLIC_DOMAIN: "air-jam-platform-air-jam-pr-17.up.railway.app",
        NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST:
          "https://air-jam-platform-production.up.railway.app",
        NEXT_PUBLIC_APP_URL:
          "https://air-jam-platform-production.up.railway.app",
        BETTER_AUTH_URL: "https://air-jam-platform-production.up.railway.app",
      }),
    ).toMatchObject({
      platformPublicUrl: "https://air-jam-platform-air-jam-pr-17.up.railway.app",
      authBaseUrl: "https://air-jam-platform-air-jam-pr-17.up.railway.app",
      hasExplicitPlatformPublicOrigin: true,
    });
  });

  it("collects trusted origins from every relevant deployment identity source", () => {
    expect(
      resolvePlatformDeploymentConfig({
        NEXT_PUBLIC_AIR_JAM_PUBLIC_HOST: "https://preview.airjam.io",
        RAILWAY_PUBLIC_DOMAIN: "platform-preview.up.railway.app",
        BETTER_AUTH_TRUSTED_ORIGINS:
          "https://foo.airjam.io, https://preview.airjam.io",
      }).authTrustedOrigins,
    ).toEqual([
      "https://preview.airjam.io",
      "https://platform-preview.up.railway.app",
      "https://foo.airjam.io",
    ]);
  });

  it("derives github auth availability from credentials unless explicitly overridden", () => {
    expect(
      resolvePlatformDeploymentConfig({
        GITHUB_CLIENT_ID: "github-client-id",
        GITHUB_CLIENT_SECRET: "github-client-secret",
      }).githubAuthEnabled,
    ).toBe(true);

    expect(
      resolvePlatformDeploymentConfig({
        GITHUB_CLIENT_ID: "github-client-id",
        GITHUB_CLIENT_SECRET: "github-client-secret",
        NEXT_PUBLIC_AUTH_GITHUB_ENABLED: "false",
      }).githubAuthEnabled,
    ).toBe(false);
  });

  it("trims app identity values and falls back to localhost when unset", () => {
    expect(
      resolvePlatformDeploymentConfig({
        NEXT_PUBLIC_AIR_JAM_APP_ID: "  airjam-preview-app  ",
      }),
    ).toMatchObject({
      platformPublicUrl: PLATFORM_PUBLIC_URL_FALLBACK,
      appId: "airjam-preview-app",
    });
  });

  it("defaults the platform system host grant endpoint in production", () => {
    expect(
      resolvePlatformDeploymentConfig({
        NODE_ENV: "production",
      }).systemHostGrantEndpoint,
    ).toBe("/api/airjam/host-grant");

    expect(
      resolvePlatformDeploymentConfig({
        NODE_ENV: "production",
        NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT: "https://auth.airjam.io/grant",
      }).systemHostGrantEndpoint,
    ).toBe("https://auth.airjam.io/grant");

    expect(
      resolvePlatformDeploymentConfig({
        NODE_ENV: "development",
      }).systemHostGrantEndpoint,
    ).toBeUndefined();
  });
});
