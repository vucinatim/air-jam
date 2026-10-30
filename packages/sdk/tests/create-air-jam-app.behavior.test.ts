import { resolveRuntimeTopology } from "@air-jam/sdk/runtime-topology";
import { describe, expect, it } from "vitest";
import {
  agentStore,
  defineAirJamAgentContract,
  defineAirJamAgentStores,
} from "../src/agent/agent-contract";
import { defineAirJamGame } from "../src/core/game";
import { defineAirJamInput, stick } from "../src/core/input";
import { defineAirJamGameMetadata } from "../src/metadata";
import {
  AIR_JAM_RUNTIME_INSPECTION_KEY,
  publishRuntimeInspectionContract,
  readRuntimeInspectionContract,
} from "../src/runtime/contracts/inspection";
import { createAirJamApp } from "../src/runtime/create-air-jam-app";

describe("createAirJamApp", () => {
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
  it("binds one declaration to the browser environment and its declared capacity", () => {
    const topology = resolveRuntimeTopology({
      runtimeMode: "self-hosted-production",
      surfaceRole: "host",
      appOrigin: "https://play.example.com",
      backendOrigin: "https://api.example.com",
      publicHost: "https://play.example.com",
    });
    const input = defineAirJamInput({ move: stick() });
    const agent = defineAirJamAgentContract({
      stores: defineAirJamAgentStores({
        default: agentStore<{ phase: string }>(),
      }),
      projectSnapshot: () => ({ phase: "lobby" }),
      actions: {},
    });
    const game = defineAirJamGame({
      metadata,
      input,
      agent,
      controllerPath: "phone",
    });
    const app = createAirJamApp(game, { runtime: { topology } });
    expect(app.paths.controller).toBe("/phone");
    expect(app.session.host.maxPlayers).toBe(4);
    expect(app.session.host.topology?.backendOrigin).toBe(
      "https://api.example.com",
    );
    expect(app.session.controller.topology?.publicHost).toBe(
      "https://play.example.com",
    );
    expect(Object.keys(app).sort()).toEqual([
      "Controller",
      "Host",
      "paths",
      "session",
    ]);
    expect(game.input).toBe(input);
    expect(game.agent).toBe(agent);
    expect(
      createAirJamApp(defineAirJamGame({ metadata })).paths.controller,
    ).toBe("/controller");
  });
  it("names the replacement when passed the old options object", () => {
    expect(() => Reflect.apply(createAirJamApp, null, [{}])).toThrow(
      /defineAirJamGame.*second argument/,
    );
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
