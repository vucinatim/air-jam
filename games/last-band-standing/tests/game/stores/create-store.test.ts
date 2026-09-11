import { DEFAULT_TOTAL_ROUNDS } from "@/game/constants";
import { useGameStore } from "@/game/stores/create-store";
import { afterEach, describe, expect, it, vi } from "vitest";

const completeMatch = (playerCount: number) => {
  const playerIds = Array.from(
    { length: playerCount },
    (_, index) => `player-${String(index + 1).padStart(2, "0")}`,
  );
  const hostContext = {
    actorId: "host",
    role: "host" as const,
    connectedPlayerIds: playerIds,
  };

  useGameStore.getState().actions.resetLobby(hostContext, undefined);
  useGameStore.getState().actions.setPlayers(hostContext, {
    players: playerIds.map((id, index) => ({
      id,
      label: `Player ${index + 1}`,
    })),
  });

  playerIds.forEach((playerId) => {
    useGameStore.getState().actions.setReady(
      {
        actorId: playerId,
        role: "controller",
        connectedPlayerIds: playerIds,
      },
      { ready: true },
    );
  });

  useGameStore.getState().actions.startMatch(hostContext, undefined);
  const countdownRound = useGameStore.getState().currentRound;
  if (!countdownRound) {
    throw new Error("Expected the match countdown to prepare round one.");
  }

  useGameStore.getState().actions.completeMatchCountdown(hostContext, {
    nowMs: countdownRound.startedAtMs,
  });

  for (let roundIndex = 0; roundIndex < DEFAULT_TOTAL_ROUNDS; roundIndex += 1) {
    const round = useGameStore.getState().currentRound;
    if (!round) {
      throw new Error(`Expected active round ${roundIndex + 1}.`);
    }

    playerIds.forEach((playerId, playerIndex) => {
      vi.setSystemTime(round.startedAtMs + 500 + playerIndex);
      useGameStore.getState().actions.submitGuess(
        {
          actorId: playerId,
          role: "controller",
          connectedPlayerIds: playerIds,
        },
        { optionId: round.songId },
      );
    });

    useGameStore.getState().actions.finalizeRound(hostContext, {
      nowMs: round.startedAtMs + 2_000,
    });

    const reveal = useGameStore.getState().roundReveal;
    if (!reveal) {
      throw new Error(`Expected reveal for round ${roundIndex + 1}.`);
    }

    expect(Object.keys(reveal.resultsByPlayerId)).toHaveLength(playerCount);
    expect(
      Object.values(reveal.resultsByPlayerId).every(
        (result) => result.isCorrect,
      ),
    ).toBe(true);

    useGameStore.getState().actions.advanceFromReveal(hostContext, {
      nowMs: reveal.revealEndsAtMs,
    });
  }

  const finalState = useGameStore.getState();
  expect(finalState.phase).toBe("game-over");
  expect(finalState.completedRoundCount).toBe(DEFAULT_TOTAL_ROUNDS);
  expect(finalState.finalRankingPlayerIds).toEqual(playerIds);
  expect(Object.keys(finalState.scoreboardByPlayerId)).toHaveLength(
    playerCount,
  );
  playerIds.forEach((playerId) => {
    expect(finalState.scoreboardByPlayerId[playerId]?.correct).toBe(
      DEFAULT_TOTAL_ROUNDS,
    );
  });
};

describe("complete match lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires all lobby players ready before a controller can start", () => {
    const host = {
      actorId: "host",
      role: "host" as const,
      connectedPlayerIds: ["alpha", "beta"],
    };
    const alpha = { ...host, actorId: "alpha", role: "controller" as const };
    const actions = useGameStore.getState().actions;
    actions.resetLobby(host, undefined);
    actions.setPlayers(host, {
      players: [
        { id: "alpha", label: "Alpha" },
        { id: "beta", label: "Beta" },
      ],
    });
    actions.setReady(alpha, { ready: true });
    actions.startMatch(alpha, undefined);
    expect(useGameStore.getState().phase).toBe("lobby");
    actions.startMatch(host, undefined);
    expect(useGameStore.getState().phase).toBe("lobby");
    actions.setReady({ ...alpha, actorId: "beta" }, { ready: true });
    actions.startMatch(alpha, undefined);
    expect(useGameStore.getState().phase).toBe("match-countdown");
    actions.resetLobby(host, undefined);
  });

  it.each([2, 6, 10])(
    "completes every round and ranks all %i players",
    (playerCount) => {
      vi.useFakeTimers();
      vi.setSystemTime("2026-07-24T12:00:00Z");

      completeMatch(playerCount);
    },
  );
});
