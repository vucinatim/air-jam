import { describe, expect, it } from "vitest";
import { isMatchReadyToStart } from "../../../src/game/domain/match-readiness";
import type { GamePhase } from "../../../src/game/domain/types";

const readyLobby = {
  phase: "lobby" as const,
  playerIds: ["alpha", "beta"],
  readyByPlayerId: { alpha: true, beta: true },
  hasEnoughSongs: true,
};

describe("match readiness", () => {
  it("allows every ready lobby player to start with enough songs", () => {
    expect(isMatchReadyToStart(readyLobby)).toBe(true);
  });

  it("requires a nonempty roster, every readiness flag, and enough songs", () => {
    expect(isMatchReadyToStart({ ...readyLobby, playerIds: [] })).toBe(false);
    expect(
      isMatchReadyToStart({ ...readyLobby, readyByPlayerId: { alpha: true } }),
    ).toBe(false);
    expect(
      isMatchReadyToStart({
        ...readyLobby,
        readyByPlayerId: { alpha: true, beta: false },
      }),
    ).toBe(false);
    expect(isMatchReadyToStart({ ...readyLobby, hasEnoughSongs: false })).toBe(
      false,
    );
  });

  it("ignores readiness entries outside the current roster", () => {
    expect(
      isMatchReadyToStart({
        ...readyLobby,
        playerIds: ["alpha"],
        readyByPlayerId: { alpha: true, departed: false },
      }),
    ).toBe(true);
  });

  it.each<GamePhase>([
    "match-countdown",
    "round-active",
    "round-reveal",
    "game-over",
  ])("does not start during %s", (phase) => {
    expect(isMatchReadyToStart({ ...readyLobby, phase })).toBe(false);
  });
});
