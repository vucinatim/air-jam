import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  onAirJamDiagnostic,
  resetAirJamDiagnosticsForTests,
  setAirJamDiagnosticsEnabled,
} from "../src/diagnostics";
import { resolveAirJamConfig } from "../src/runtime/air-jam-config";

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

  it("emits actionable error diagnostic in production when API key is missing", () => {
    process.env.NODE_ENV = "production";
    delete process.env.VITE_AIR_JAM_PUBLIC_KEY;
    delete process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_KEY;

    const codes: string[] = [];
    const unsubscribe = onAirJamDiagnostic((diagnostic) => {
      codes.push(diagnostic.code);
    });

    const resolved = resolveAirJamConfig({
      serverUrl: "https://api.example.com",
    });

    expect(resolved.apiKey).toBeUndefined();
    expect(codes).toContain("AJ_CONFIG_MISSING_API_KEY");
    unsubscribe();
  });

  it("ignores removed legacy API key env names", () => {
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_AIR_JAM_API_KEY = "legacy-key";
    process.env.VITE_AIR_JAM_API_KEY = "legacy-vite-key";
    delete process.env.NEXT_PUBLIC_AIR_JAM_PUBLIC_KEY;
    delete process.env.VITE_AIR_JAM_PUBLIC_KEY;

    const resolved = resolveAirJamConfig({
      serverUrl: "https://api.example.com",
    });

    expect(resolved.apiKey).toBeUndefined();
  });
});
