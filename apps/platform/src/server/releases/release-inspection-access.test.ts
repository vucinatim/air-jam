import { describe, expect, it } from "vitest";
import {
  createReleaseInspectionAccessToken,
  verifyReleaseInspectionAccessToken,
} from "./release-inspection-access";

describe("release inspection access", () => {
  it("accepts a valid scoped token for the matching release", () => {
    const token = createReleaseInspectionAccessToken({
      gameId: "game-1",
      releaseId: "release-1",
      secret: "secret-1",
      expiresAtMs: 10_000,
    });

    expect(
      verifyReleaseInspectionAccessToken({
        token,
        gameId: "game-1",
        releaseId: "release-1",
        secret: "secret-1",
        nowMs: 5_000,
      }),
    ).toBe(true);
  });

  it("rejects a token for another release", () => {
    const token = createReleaseInspectionAccessToken({
      gameId: "game-1",
      releaseId: "release-1",
      secret: "secret-1",
      expiresAtMs: 10_000,
    });

    expect(
      verifyReleaseInspectionAccessToken({
        token,
        gameId: "game-1",
        releaseId: "release-2",
        secret: "secret-1",
        nowMs: 5_000,
      }),
    ).toBe(false);
  });

  it("rejects expired tokens", () => {
    const token = createReleaseInspectionAccessToken({
      gameId: "game-1",
      releaseId: "release-1",
      secret: "secret-1",
      expiresAtMs: 10_000,
    });

    expect(
      verifyReleaseInspectionAccessToken({
        token,
        gameId: "game-1",
        releaseId: "release-1",
        secret: "secret-1",
        nowMs: 10_000,
      }),
    ).toBe(false);
  });

  it("rejects the raw secret as a bearer token", () => {
    expect(
      verifyReleaseInspectionAccessToken({
        token: "secret-1",
        gameId: "game-1",
        releaseId: "release-1",
        secret: "secret-1",
        nowMs: 5_000,
      }),
    ).toBe(false);
  });
});
