import { describe, expect, it } from "vitest";
import { arcadeBridgeRequestSurfaceMismatchesActive } from "../src/runtime/arcade-bridge-request-surface";

describe("arcadeBridgeRequestSurfaceMismatchesActive", () => {
  const active = {
    epoch: 2,
    kind: "game" as const,
    gameId: "pong",
  };

  it("returns false when request omits surface (legacy)", () => {
    expect(arcadeBridgeRequestSurfaceMismatchesActive(active, undefined)).toBe(
      false,
    );
  });

  it("returns false when request matches active", () => {
    expect(
      arcadeBridgeRequestSurfaceMismatchesActive(active, { ...active }),
    ).toBe(false);
  });

  it("returns true when epoch differs", () => {
    expect(
      arcadeBridgeRequestSurfaceMismatchesActive(active, {
        ...active,
        epoch: 1,
      }),
    ).toBe(true);
  });

  it("returns true when gameId differs", () => {
    expect(
      arcadeBridgeRequestSurfaceMismatchesActive(active, {
        ...active,
        gameId: "other",
      }),
    ).toBe(true);
  });
});
