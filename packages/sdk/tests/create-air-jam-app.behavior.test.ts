import { resolveRuntimeTopology } from "@air-jam/runtime-topology";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createAirJamApp } from "../src/runtime/create-air-jam-app";

describe("createAirJamApp", () => {
  it("normalizes controller path and provides defaults", () => {
    const baseTopology = resolveRuntimeTopology({
      runtimeMode: "self-hosted-production",
      surfaceRole: "host",
      appOrigin: "https://play.example.com",
      backendOrigin: "https://api.example.com",
      publicHost: "https://play.example.com",
    });
    const withDefaultPath = createAirJamApp({
      runtime: {
        topology: baseTopology,
      },
    });
    const withCustomPath = createAirJamApp({
      runtime: {
        topology: baseTopology,
      },
      game: {
        controllerPath: "custom-controller",
      },
    });

    expect(withDefaultPath.paths.controller).toBe("/controller");
    expect(withCustomPath.paths.controller).toBe("/custom-controller");
  });

  it("keeps runtime and input schema in host/controller session wiring", () => {
    const inputSchema = z.object({
      vector: z.object({ x: z.number(), y: z.number() }),
      timestamp: z.number(),
    });

    const airjam = createAirJamApp({
      runtime: {
        topology: resolveRuntimeTopology({
          runtimeMode: "self-hosted-production",
          surfaceRole: "host",
          appOrigin: "https://play.example.com",
          backendOrigin: "https://api.example.com",
          publicHost: "https://play.example.com",
        }),
      },
      input: {
        schema: inputSchema,
      },
    });

    expect(airjam.session.host.topology?.backendOrigin).toBe(
      "https://api.example.com",
    );
    expect(airjam.session.host.topology?.publicHost).toBe(
      "https://play.example.com",
    );
    expect(airjam.session.host.input?.schema).toBe(inputSchema);
    expect(airjam.session.controller.topology?.backendOrigin).toBe(
      "https://api.example.com",
    );
    expect(airjam.session.controller.topology?.publicHost).toBe(
      "https://play.example.com",
    );
    expect("input" in airjam.session.controller).toBe(false);
  });
});
