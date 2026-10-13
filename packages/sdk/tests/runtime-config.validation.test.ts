import {
  AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY,
  resolveRuntimeTopology,
  runtimeTopologyToQueryParams,
} from "@air-jam/sdk/runtime-topology";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  onAirJamDiagnostic,
  resetAirJamDiagnosticsForTests,
  setAirJamDiagnosticsEnabled,
} from "../src/diagnostics";
import { resolveAirJamConfig } from "../src/runtime/air-jam-config";
import { env } from "../src/runtime/create-air-jam-app";

const originalEnv = { ...process.env };
const originalWindow = globalThis.window;

describe("runtime config validation", () => {
  beforeEach(() => {
    resetAirJamDiagnosticsForTests();
    setAirJamDiagnosticsEnabled(true);
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetAirJamDiagnosticsForTests();
    if (originalWindow === undefined) {
      delete (globalThis as { window?: Window }).window;
    } else {
      globalThis.window = originalWindow;
      delete (globalThis.window as unknown as Record<string, unknown>)[
        AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY
      ];
    }
  });

  it("throws actionable error when resolveEnv is disabled and topology is missing", () => {
    expect(() =>
      resolveAirJamConfig({
        resolveEnv: false,
      }),
    ).toThrow("[AirJam][AJ_CONFIG_MISSING_RUNTIME_TOPOLOGY]");
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
      topology: resolveRuntimeTopology({
        runtimeMode: "self-hosted-production",
        surfaceRole: "host",
        appOrigin: "https://play.example.com",
        backendOrigin: "https://api.example.com",
      }),
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
      topology: resolveRuntimeTopology({
        runtimeMode: "self-hosted-production",
        surfaceRole: "host",
        appOrigin: "https://play.example.com",
        backendOrigin: "https://api.example.com",
      }),
    });

    expect(resolved.appId).toBeUndefined();
  });

  it("resolves host grant endpoint from environment", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_AIR_JAM_HOST_GRANT_ENDPOINT =
      "https://example.com/api/airjam/host-grant";

    const resolved = resolveAirJamConfig({
      topology: resolveRuntimeTopology({
        runtimeMode: "self-hosted-production",
        surfaceRole: "host",
        appOrigin: "https://play.example.com",
        backendOrigin: "https://api.example.com",
      }),
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
      topology: resolveRuntimeTopology({
        runtimeMode: "self-hosted-production",
        surfaceRole: "host",
        appOrigin: "https://play.example.com",
        backendOrigin: "https://api.example.com",
        publicHost: "https://play.example.com",
      }),
      appId: "aj_app_test",
      hostGrantEndpoint: "https://example.com/api/airjam/host-grant",
      resolveEnv: false,
    });
  });

  it("prefers an explicit window bootstrap topology over runtime inference", () => {
    globalThis.window = {
      location: {
        search: "",
      },
    } as unknown as Window & typeof globalThis;
    (globalThis.window as unknown as Record<string, unknown>)[
      AIR_JAM_RUNTIME_TOPOLOGY_WINDOW_KEY
    ] = {
      runtimeMode: "hosted-release",
      surfaceRole: "host",
      appOrigin: "https://play.example.com",
      backendOrigin: "https://api.example.com",
      publicHost: "https://play.example.com",
      assetBasePath: "/releases/g/game-1/r/release-1",
      secureTransport: true,
      embedded: false,
      proxyStrategy: "none",
    };

    const resolved = resolveAirJamConfig({});

    expect(resolved.topology).toEqual(
      resolveRuntimeTopology({
        runtimeMode: "hosted-release",
        surfaceRole: "host",
        appOrigin: "https://play.example.com",
        backendOrigin: "https://api.example.com",
        publicHost: "https://play.example.com",
        assetBasePath: "/releases/g/game-1/r/release-1",
        secureTransport: true,
        embedded: false,
        proxyStrategy: "none",
      }),
    );
  });

  it("uses complete development surface topology over baked Vite defaults for host and controller", () => {
    const defaults = resolveRuntimeTopology({
      runtimeMode: "standalone-dev",
      surfaceRole: "host",
      appOrigin: "http://human.localhost:8791",
      backendOrigin: "http://127.0.0.1:4000",
      proxyStrategy: "dev-proxy",
    });
    const contained = resolveRuntimeTopology({
      ...defaults,
      appOrigin: "http://127.0.0.1:5173",
      socketOrigin: "http://127.0.0.1:5173",
      publicHost: "http://127.0.0.1:5173",
    });
    globalThis.window = {
      location: {
        origin: contained.appOrigin,
        search: `?${new URLSearchParams(runtimeTopologyToQueryParams(contained))}`,
      },
    } as unknown as Window & typeof globalThis;
    const runtime = env.vite({
      DEV: true,
      VITE_AIR_JAM_RUNTIME_TOPOLOGY: JSON.stringify(defaults),
    });
    expect(resolveAirJamConfig(runtime).topology).toEqual(contained);
    expect(
      resolveAirJamConfig({ ...runtime, surfaceRole: "controller" }).topology,
    ).toEqual({ ...contained, surfaceRole: "controller" });
    expect(resolveAirJamConfig({ topology: defaults }).topology).toEqual(
      defaults,
    );
    process.env.AIR_JAM_RUNTIME_TOPOLOGY = JSON.stringify(defaults);
    expect(resolveAirJamConfig({}).topology).toEqual(contained);
  });

  it("keeps production defaults authoritative over URL topology and rejects incomplete development overrides", () => {
    const defaults = resolveRuntimeTopology({
      runtimeMode: "self-hosted-production",
      surfaceRole: "host",
      appOrigin: "https://game.example.com",
      backendOrigin: "https://backend.example.com",
    });
    globalThis.window = {
      location: {
        origin: defaults.appOrigin,
        search: "?aj_topology_app_origin=http://127.0.0.1:5173",
      },
    } as unknown as Window & typeof globalThis;
    expect(
      env.vite({
        DEV: false,
        VITE_AIR_JAM_RUNTIME_TOPOLOGY: JSON.stringify(defaults),
      }).topology,
    ).toEqual(defaults);
    expect(() =>
      env.vite({
        DEV: true,
        VITE_AIR_JAM_RUNTIME_TOPOLOGY: JSON.stringify({
          ...defaults,
          runtimeMode: "standalone-dev",
        }),
      }),
    ).toThrow("search params are incomplete");
    globalThis.window.location.search = `?${new URLSearchParams(runtimeTopologyToQueryParams(defaults))}`;
    expect(() =>
      env.vite({
        DEV: true,
        VITE_AIR_JAM_RUNTIME_TOPOLOGY: JSON.stringify({
          ...defaults,
          runtimeMode: "standalone-dev",
        }),
      }),
    ).toThrow("must use a local development mode");
  });
});
