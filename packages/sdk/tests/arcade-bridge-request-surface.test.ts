import { describe, expect, it } from "vitest";
import { isArcadeSurfaceMismatch } from "../src/runtime/arcade-bridge-request-surface";

describe("isArcadeSurfaceMismatch", () => {
  const active = {
    epoch: 2,
    kind: "game" as const,
    gameId: "pong",
  };

  it("returns false when request matches active", () => {
    expect(
      isArcadeSurfaceMismatch(active, { ...active }),
    ).toBe(false);
  });

  it("returns true when epoch differs", () => {
    expect(
      isArcadeSurfaceMismatch(active, {
        ...active,
        epoch: 1,
      }),
    ).toBe(true);
  });

  it("returns true when gameId differs", () => {
    expect(
      isArcadeSurfaceMismatch(active, {
        ...active,
        gameId: "other",
      }),
    ).toBe(true);
  });
});
