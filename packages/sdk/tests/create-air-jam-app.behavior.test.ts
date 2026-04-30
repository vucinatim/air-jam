import { resolveRuntimeTopology } from "@air-jam/runtime-topology";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineAirJamAgentContract,
  defineAirJamAgentStores,
  agentStore,
} from "../src/agent/agent-contract";
import { defineAirJamGameMetadata } from "../src/metadata";
import { createAirJamApp } from "../src/runtime/create-air-jam-app";
import {
  AIR_JAM_RUNTIME_INSPECTION_KEY,
  publishRuntimeInspectionContract,
  readRuntimeInspectionContract,
} from "../src/runtime-inspection";

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
      controllerPath: "custom-controller",
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

  it("exposes agent-facing contracts on the returned app config", () => {
    const agent = defineAirJamAgentContract({
      stores: defineAirJamAgentStores({
        default: agentStore<{ phase: string }>(),
      }),
      projectSnapshot: () => ({ phase: "lobby" }),
      actions: {},
    });
    const metadata = defineAirJamGameMetadata({
      slug: "fixture-game",
      name: "Fixture Game",
      tagline: "Fixture",
      category: "arcade",
      minPlayers: 1,
      maxPlayers: 4,
      inputModalities: ["buttons"],
      supportedSdkRange: "^1.0.0",
      maintainer: { name: "Air Jam" },
    });
    const airjam = createAirJamApp({
      metadata,
      controllerPath: "controller",
      agent,
      visualScenariosModule: "../visual/scenarios.ts",
    });

    expect(airjam.controllerPath).toBe("/controller");
    expect(airjam.metadata?.slug).toBe("fixture-game");
    expect(airjam.agent).toBe(agent);
    expect(airjam.visualScenariosModule).toBe("../visual/scenarios.ts");
  });

  it("publishes and reads runtime inspection contracts through one SDK key", () => {
    const target: Record<string, unknown> = {};

    publishRuntimeInspectionContract(target, {
      role: "host",
      roomId: "ROOM1",
      joinUrl: "http://127.0.0.1:5173/controller?room=ROOM1",
      joinUrlStatus: "ready",
      connectionStatus: "connected",
      players: [],
      controllers: [],
      mode: "standalone",
      runtimeState: "playing",
    });

    expect(target[AIR_JAM_RUNTIME_INSPECTION_KEY]).toMatchObject({
      role: "host",
      roomId: "ROOM1",
    });
    expect(readRuntimeInspectionContract(target)).toMatchObject({
      role: "host",
      roomId: "ROOM1",
      joinUrlStatus: "ready",
    });

    publishRuntimeInspectionContract(target, null);
    expect(readRuntimeInspectionContract(target)).toBeNull();
  });
});
