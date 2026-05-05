import { beforeEach, describe, expect, it, vi } from "vitest";
import { serializeRuntimeTopology } from "@air-jam/sdk/runtime-topology";
import { resolvePlatformTopology } from "./airjam-session-config";

const ORIGINAL_WINDOW = globalThis.window;

describe("resolvePlatformTopology", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_AIR_JAM_PLATFORM_HOST_TOPOLOGY;
    delete process.env.NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY;

    if (ORIGINAL_WINDOW === undefined) {
      // @ts-expect-error test cleanup
      delete globalThis.window;
    } else {
      globalThis.window = ORIGINAL_WINDOW;
    }
  });

  it("keeps hosted production topology unchanged", () => {
    process.env.NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY =
      serializeRuntimeTopology({
        runtimeMode: "hosted-release",
        surfaceRole: "platform-controller",
        appOrigin: "https://airjam.io",
        backendOrigin: "https://api.airjam.io",
        publicHost: "https://airjam.io",
        proxyStrategy: "none",
      });

    vi.stubGlobal("window", {
      location: { origin: "http://localhost:3000" },
    });

    expect(
      resolvePlatformTopology("NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY")
        .appOrigin,
    ).toBe("https://airjam.io");
  });

  it("rebases local dev controller shell origins to the actual browser origin", () => {
    process.env.NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY =
      serializeRuntimeTopology({
        runtimeMode: "arcade-live",
        surfaceRole: "platform-controller",
        appOrigin: "http://192.168.0.33:3000",
        backendOrigin: "http://127.0.0.1:4000",
        publicHost: "http://192.168.0.33:3000",
        proxyStrategy: "platform-proxy",
      });

    vi.stubGlobal("window", {
      location: { origin: "http://localhost:3000" },
    });

    const topology = resolvePlatformTopology(
      "NEXT_PUBLIC_AIR_JAM_PLATFORM_CONTROLLER_TOPOLOGY",
    );

    expect(topology.appOrigin).toBe("http://localhost:3000");
    expect(topology.socketOrigin).toBe("http://localhost:3000");
    expect(topology.publicHost).toBe("http://192.168.0.33:3000");
  });
});
