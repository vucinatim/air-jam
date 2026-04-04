import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  onAirJamDiagnostic,
  resetAirJamDiagnosticsForTests,
  setAirJamDiagnosticsEnabled,
} from "../src/diagnostics";
import { resolveAirJamConfig } from "../src/runtime/air-jam-config";
import { env } from "../src/runtime/create-air-jam-app";

const originalEnv = { ...process.env };

describe("runtime config validation", () => {
  beforeEach(() => {
    resetAirJamDiagnosticsForTests();
    setAirJamDiagnosticsEnabled(true);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetAirJamDiagnosticsForTests();
  });

  it("throws actionable error when resolveEnv is disabled and serverUrl is missing", () => {
    expect(() =>
      resolveAirJamConfig({
        resolveEnv: false,
      }),
    ).toThrow("[AirJam][AJ_CONFIG_MISSING_SERVER_URL]");
  });

  it("emits actionable error diagnostic in production when app ID is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.VITE_AIR_JAM_APP_ID;
    delete process.env.NEXT_PUBLIC_AIR_JAM_APP_ID;

    const codes: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      codes.push(diagnostic.code);
    });

    const resolved = resolveAirJamConfig({
      serverUrl: "https://api.example.com",
    });

    expect(resolved.appId).toBeUndefined();
    expect(codes).toContain("AJ_CONFIG_MISSING_APP_ID");
    unsubscribe();
  });

  it("ignores removed legacy app ID env names", () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_KEY = "legacy-key";
    process.env.VITE_AIR_JAM_PUBLIC_KEY = "legacy-vite-key";
    delete process.env.NEXT_PUBLIC_AIR_JAM_APP_ID;
    delete process.env.VITE_AIR_JAM_APP_ID;

    const resolved = resolveAirJamConfig({
      serverUrl: "https://api.example.com",
    });

    expect(resolved.appId).toBeUndefined();
  });

  it("resolves host grant endpoint from environment", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT =
      "https://example.com/api/airjam/host-grant";

    const resolved = resolveAirJamConfig({
      serverUrl: "https://api.example.com",
    });

    expect(resolved.hostGrantEndpoint).toBe(
      "https://example.com/api/airjam/host-grant",
    );
  });

  it("accepts explicit vite env input at the app boundary", () => {
    const runtime = env.vite({
      VITE_AIR_JAM_SERVER_URL: "https://api.example.com",
      VITE_AIR_JAM_APP_ID: "aj_app_test",
      VITE_AIR_JAM_HOST_GRANT_ENDPOINT:
        "https://example.com/api/airjam/host-grant",
      VITE_AIR_JAM_PUBLIC_HOST: "https://play.example.com",
    });

    expect(runtime).toEqual({
      serverUrl: "https://api.example.com",
      appId: "aj_app_test",
      hostGrantEndpoint: "https://example.com/api/airjam/host-grant",
      publicHost: "https://play.example.com",
      resolveEnv: true,
    });
  });
});
