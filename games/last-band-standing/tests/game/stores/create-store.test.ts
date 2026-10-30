import type { QuizSettings } from "@/game/contracts/settings";
import { quizSettings } from "@/game/contracts/settings";
import { gameStore } from "@/game/stores/create-store";
import { describe, expect, it } from "vitest";

const settings = Object.fromEntries(
  Object.entries(quizSettings).map(([name, definition]) => [
    name,
    definition.default,
  ]),
) as QuizSettings;

const completeMatch = (playerCount: number) => {
  const playerIds = Array.from(
    { length: playerCount },
    (_, index) => `player-${String(index + 1).padStart(2, "0")}`,
  );
  const hostContext = {
    actorId: "host",
    role: "host" as const,
    connectedPlayerIds: playerIds,
    settings,
    now: 0,
  };
  const hostAt = (now: number) => ({ ...hostContext, now });

  gameStore.getState().actions.resetLobby(hostContext, undefined);
  gameStore.getState().actions.setPlayers(hostContext, {
    players: playerIds.map((id, index) => ({
      id,
      label: `Player ${index + 1}`,
    })),
  });

  playerIds.forEach((playerId) => {
    gameStore.getState().actions.setReady(
      {
        actorId: playerId,
        role: "controller",
        connectedPlayerIds: playerIds,
        settings,
        now: 0,
      },
      { ready: true },
    );
  });

  gameStore.getState().actions.startMatch(hostContext, undefined);
  const countdownRound = gameStore.getState().currentRound;
  if (!countdownRound) {
    throw new Error("Expected the match countdown to prepare round one.");
  }

  gameStore
    .getState()
    .actions.advanceClock(hostAt(countdownRound.startedAtMs), undefined);
  expect(gameStore.getState().phase).toBe("round-active");

  for (
    let roundIndex = 0;
    roundIndex < quizSettings.totalRounds.default;
    roundIndex += 1
  ) {
    const round = gameStore.getState().currentRound;
    if (!round) {
      throw new Error(`Expected active round ${roundIndex + 1}.`);
    }

    playerIds.forEach((playerId, playerIndex) => {
      gameStore.getState().actions.submitGuess(
        {
          actorId: playerId,
          role: "controller",
          connectedPlayerIds: playerIds,
          settings,
          now: round.startedAtMs + 500 + playerIndex,
        },
        { optionId: round.songId },
      );
    });

    gameStore
      .getState()
      .actions.advanceClock(hostAt(round.startedAtMs + 2_000), undefined);

    const reveal = gameStore.getState().roundReveal;
    if (!reveal) {
      throw new Error(`Expected reveal for round ${roundIndex + 1}.`);
    }

    expect(Object.keys(reveal.resultsByPlayerId)).toHaveLength(playerCount);
    expect(
      Object.values(reveal.resultsByPlayerId).every(
        (result) => result.isCorrect,
      ),
    ).toBe(true);

    gameStore
      .getState()
      .actions.advanceClock(hostAt(reveal.revealEndsAtMs), undefined);
  }

  const finalState = gameStore.getState();
  expect(finalState.phase).toBe("game-over");
  expect(finalState.completedRoundCount).toBe(quizSettings.totalRounds.default);
  expect(finalState.finalRankingPlayerIds).toEqual(playerIds);
  expect(Object.keys(finalState.scoreboardByPlayerId)).toHaveLength(
    playerCount,
  );
  playerIds.forEach((playerId) => {
    expect(finalState.scoreboardByPlayerId[playerId]?.correct).toBe(
      quizSettings.totalRounds.default,
    );
  });
};

describe("complete match lifecycle", () => {
  it("counts down whole seconds on game time and ends the round when time runs out", () => {
    const host = {
      actorId: "host",
      role: "host" as const,
      connectedPlayerIds: ["alpha", "beta"],
      settings,
      now: 10_000,
    };
    const actions = gameStore.getState().actions;
    actions.resetLobby(host, undefined);
    actions.setPlayers(host, {
      players: [
        { id: "alpha", label: "Alpha" },
        { id: "beta", label: "Beta" },
      ],
    });
    for (const actorId of ["alpha", "beta"])
      actions.setReady(
        { ...host, actorId, role: "controller" },
        { ready: true },
      );
    actions.startMatch(host, undefined);
    actions.advanceClock({ ...host, now: 10_100 }, undefined);
    expect(gameStore.getState().secondsLeft).toBe(3);
    actions.advanceClock({ ...host, now: 11_100 }, undefined);
    expect(gameStore.getState().secondsLeft).toBe(2);

    const round = gameStore.getState().currentRound;
    if (!round) throw new Error("Expected round one.");
    actions.advanceClock({ ...host, now: round.startedAtMs }, undefined);
    expect(gameStore.getState()).toMatchObject({
      phase: "round-active",
      secondsLeft: (round.endsAtMs - round.startedAtMs) / 1000,
    });
    actions.advanceClock({ ...host, now: round.endsAtMs }, undefined);
    expect(gameStore.getState().phase).toBe("round-reveal");
    actions.resetLobby(host, undefined);
  });

  it("requires all lobby players ready before a controller can start", () => {
    const host = {
      actorId: "host",
      role: "host" as const,
      connectedPlayerIds: ["alpha", "beta"],
      settings,
      now: 0,
    };
    const alpha = { ...host, actorId: "alpha", role: "controller" as const };
    const actions = gameStore.getState().actions;
    actions.resetLobby(host, undefined);
    actions.setPlayers(host, {
      players: [
        { id: "alpha", label: "Alpha" },
        { id: "beta", label: "Beta" },
      ],
    });
    actions.setReady(alpha, { ready: true });
    actions.startMatch(alpha, undefined);
    expect(gameStore.getState().phase).toBe("lobby");
    actions.startMatch(host, undefined);
    expect(gameStore.getState().phase).toBe("lobby");
    actions.setReady({ ...alpha, actorId: "beta" }, { ready: true });
    actions.startMatch(alpha, undefined);
    expect(gameStore.getState().phase).toBe("match-countdown");
    actions.resetLobby(host, undefined);
  });

  it.each([2, 6, 10])(
    "completes every round and ranks all %i players",
    (playerCount) => {
      completeMatch(playerCount);
    },
  );
});
