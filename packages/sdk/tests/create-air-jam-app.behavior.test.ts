import { z } from "zod";
import { describe, expect, it } from "vitest";
import { createAirJamApp } from "../src/runtime/create-air-jam-app";

describe("createAirJamApp", () => {
  it("normalizes controller path and provides defaults", () => {
    const withDefaultPath = createAirJamApp();
    const withCustomPath = createAirJamApp({
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
        serverUrl: "https://api.example.com",
        publicHost: "https://play.example.com",
      },
      input: {
        schema: inputSchema,
      },
    });

    expect(airjam.session.host.serverUrl).toBe("https://api.example.com");
    expect(airjam.session.host.publicHost).toBe("https://play.example.com");
    expect(airjam.session.host.input?.schema).toBe(inputSchema);
    expect(airjam.session.controller.serverUrl).toBe("https://api.example.com");
    expect(airjam.session.controller.publicHost).toBe("https://play.example.com");
    expect("input" in airjam.session.controller).toBe(false);
  });
});
