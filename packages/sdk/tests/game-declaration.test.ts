import { describe, expect, it } from "vitest";
import { defineAirJamGame, isAirJamGame } from "../src/core/game";
import {
  airJamGameDescriptionSchema,
  describeAirJamGame,
} from "../src/core/game-description";
import { axis, button, defineAirJamInput, stick } from "../src/core/input";
import { defineAirJamInputBindings } from "../src/core/input-bindings";
import { defineAirJamGameMetadata } from "../src/metadata";
const metadata = defineAirJamGameMetadata({
  slug: "fixture",
  name: "Fixture",
  tagline: "A game",
  category: "arcade",
  minPlayers: 1,
  maxPlayers: 4,
  inputModalities: ["buttons"],
  supportedSdkRange: "^1.0.0",
  maintainer: { name: "Air Jam" },
});
describe("game declaration", () => {
  it("brands and freezes a declaration and describes only plain JSON", () => {
    const input = defineAirJamInput({
      fire: button("pressed"),
      move: stick(),
      turn: axis(),
    });
    const game = defineAirJamGame({
      metadata,
      input,
      controllerPath: "phone",
      testing: "./testing/profiles.ts",
    });
    expect(isAirJamGame(game)).toBe(true);
    expect(isAirJamGame({ ...metadata })).toBe(false);
    expect(Object.isFrozen(game)).toBe(true);
    expect(Object.isFrozen(game.stores)).toBe(true);
    expect(Object.isFrozen(game.metadata)).toBe(true);
    const description = describeAirJamGame(game);
    expect(
      airJamGameDescriptionSchema.parse(
        JSON.parse(JSON.stringify(description)),
      ),
    ).toEqual(description);
    expect(description).toEqual({
      version: 1,
      metadata,
      controllerPath: "/phone",
      simulation: false,
      input,
      settings: {},
      assets: { sounds: {}, images: {}, files: {} },
      theme: { colors: {}, fonts: {} },
      agent: null,
      testing: true,
    });
  });
  it("rejects invalid metadata and bindings without input at declaration time", () => {
    expect(() =>
      defineAirJamGame({ metadata: { ...metadata, maxPlayers: 0 } }),
    ).toThrow(/maxPlayers/);
    expect(() =>
      defineAirJamGame({
        metadata,
        inputBindings: defineAirJamInputBindings(defineAirJamInput({}), {}),
      }),
    ).toThrow(/declare input/);
  });
  it("rejects malformed controller routes and testing paths escaping the project", () => {
    for (const controllerPath of [
      "",
      "https://example.com/controller",
      "//phone",
      "/phone?x=1",
      "/../phone",
      "phone#x",
    ])
      expect(() => defineAirJamGame({ metadata, controllerPath })).toThrow(
        /controller route|small|characters/,
      );
    for (const testing of [
      "",
      "/tmp/profiles.ts",
      "../../profiles.ts",
      "file:profiles.ts",
      "C:\\profiles.ts",
    ])
      expect(() => defineAirJamGame({ metadata, testing })).toThrow();
    expect(
      defineAirJamGame({ metadata, testing: "../testing/profiles.ts" }).testing,
    ).toBe("../testing/profiles.ts");
  });
});
