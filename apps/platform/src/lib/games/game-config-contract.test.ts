import { describe, expect, it } from "vitest";
import {
  DEFAULT_GAME_CONFIG,
  parseGameConfig,
  parseGameConfigLenient,
} from "./game-config-contract";

describe("game config contract", () => {
  it("accepts optional developer catalog metadata", () => {
    expect(
      parseGameConfig({
        sourceUrl: "https://github.com/vucinatim/air-jam/tree/main/games/pong",
        templateId: "pong",
      }),
    ).toEqual({
      sourceUrl: "https://github.com/vucinatim/air-jam/tree/main/games/pong",
      templateId: "pong",
    });
  });

  it("rejects arbitrary command-like template ids", () => {
    expect(() => parseGameConfig({ templateId: "pong && whoami" })).toThrow();
  });

  it("keeps legacy invalid rows from breaking read paths", () => {
    expect(parseGameConfigLenient({ templateId: "Pong" })).toBe(
      DEFAULT_GAME_CONFIG,
    );
  });
});
