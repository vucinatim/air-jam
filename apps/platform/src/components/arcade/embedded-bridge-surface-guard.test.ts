import { describe, expect, it } from "vitest";
import {
  embeddedBridgeForwardShouldClose,
  shouldRejectControllerBridgeHandshake,
  shouldRejectHostBridgeHandshake,
} from "./embedded-bridge-surface-guard";

const gameSurface = {
  kind: "game" as const,
  epoch: 2,
  gameId: "pong",
};

describe("embeddedBridgeForwardShouldClose", () => {
  it("returns false when attach or active is missing", () => {
    expect(
      embeddedBridgeForwardShouldClose(null, gameSurface),
    ).toBe(false);
    expect(
      embeddedBridgeForwardShouldClose(gameSurface, null),
    ).toBe(false);
  });

  it("returns false when identities match", () => {
    expect(
      embeddedBridgeForwardShouldClose(gameSurface, gameSurface),
    ).toBe(false);
  });

  it("returns true on epoch drift", () => {
    expect(
      embeddedBridgeForwardShouldClose(gameSurface, {
        ...gameSurface,
        epoch: 3,
      }),
    ).toBe(true);
  });
});

describe("shouldRejectControllerBridgeHandshake", () => {
  it("does not reject when shell is browser", () => {
    expect(
      shouldRejectControllerBridgeHandshake(
        { kind: "browser", epoch: 1, gameId: null },
        gameSurface,
      ),
    ).toBe(false);
  });

  it("does not reject when shell is game but gameId is missing", () => {
    expect(
      shouldRejectControllerBridgeHandshake(
        { kind: "game", epoch: 1, gameId: null },
        gameSurface,
      ),
    ).toBe(false);
  });

  it("rejects when game shell and request surface mismatch", () => {
    expect(
      shouldRejectControllerBridgeHandshake(gameSurface, {
        ...gameSurface,
        epoch: 1,
      }),
    ).toBe(true);
  });

  it("allows legacy request without arcadeSurface on game shell", () => {
    expect(shouldRejectControllerBridgeHandshake(gameSurface, undefined)).toBe(
      false,
    );
  });
});

describe("shouldRejectHostBridgeHandshake", () => {
  it("does not reject when active identity is missing", () => {
    expect(shouldRejectHostBridgeHandshake(null, gameSurface)).toBe(false);
  });

  it("rejects on mismatch when active is set", () => {
    expect(
      shouldRejectHostBridgeHandshake(gameSurface, {
        ...gameSurface,
        gameId: "other",
      }),
    ).toBe(true);
  });
});
