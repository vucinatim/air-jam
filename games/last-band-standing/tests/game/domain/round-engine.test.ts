import { describe, expect, it } from "vitest";
import {
  buildRoundResults,
  calculateCorrectGuessPoints,
  findFirstCorrectSummary,
  rankPlayers,
  shouldFinalizeRound,
  type PlayerAnswer,
  type RoundWindow,
} from "@/game/domain/round-engine";

const makeWindow = (startMs: number, durationMs: number): RoundWindow => ({
  startedAtMs: startMs,
  endsAtMs: startMs + durationMs,
});

describe("calculateCorrectGuessPoints", () => {
  const window = makeWindow(0, 30_000);

  it("awards max points (500) for an instant answer", () => {
    expect(calculateCorrectGuessPoints(0, window)).toBe(500);
  });

  it("awards min points (100) at the buzzer", () => {
    expect(calculateCorrectGuessPoints(30_000, window)).toBe(100);
  });

  it("awards ~300 at the midpoint", () => {
    const points = calculateCorrectGuessPoints(15_000, window);
    expect(points).toBe(300);
  });

  it("clamps to min when answered after round ends", () => {
    expect(calculateCorrectGuessPoints(35_000, window)).toBe(100);
  });
});

describe("shouldFinalizeRound", () => {
  const window = makeWindow(0, 30_000);
  const players = ["alice", "bob"];

  it("returns true when time has expired", () => {
    expect(
      shouldFinalizeRound({
        expectedPlayerIds: players,
        answersByPlayerId: {},
        correctOptionId: "song-1",
        endPolicy: "wait-for-all",
        nowMs: 30_000,
        roundWindow: window,
      }),
    ).toBe(true);
  });

  it("returns true when all players have answered", () => {
    const answers: Record<string, PlayerAnswer> = {
      alice: { optionId: "song-1", answeredAtMs: 5_000 },
      bob: { optionId: "song-2", answeredAtMs: 6_000 },
    };

    expect(
      shouldFinalizeRound({
        expectedPlayerIds: players,
        answersByPlayerId: answers,
        correctOptionId: "song-1",
        endPolicy: "wait-for-all",
        nowMs: 7_000,
        roundWindow: window,
      }),
    ).toBe(true);
  });

  it("returns false in wait-for-all when some players haven't answered", () => {
    const answers: Record<string, PlayerAnswer> = {
      alice: { optionId: "song-1", answeredAtMs: 5_000 },
    };

    expect(
      shouldFinalizeRound({
        expectedPlayerIds: players,
        answersByPlayerId: answers,
        correctOptionId: "song-1",
        endPolicy: "wait-for-all",
        nowMs: 7_000,
        roundWindow: window,
      }),
    ).toBe(false);
  });

  it("returns true in rapid mode when one correct answer exists", () => {
    const answers: Record<string, PlayerAnswer> = {
      alice: { optionId: "song-1", answeredAtMs: 5_000 },
    };

    expect(
      shouldFinalizeRound({
        expectedPlayerIds: players,
        answersByPlayerId: answers,
        correctOptionId: "song-1",
        endPolicy: "rapid",
        nowMs: 7_000,
        roundWindow: window,
      }),
    ).toBe(true);
  });

  it("returns false in rapid mode when only wrong answers exist", () => {
    const answers: Record<string, PlayerAnswer> = {
      alice: { optionId: "song-2", answeredAtMs: 5_000 },
    };

    expect(
      shouldFinalizeRound({
        expectedPlayerIds: players,
        answersByPlayerId: answers,
        correctOptionId: "song-1",
        endPolicy: "rapid",
        nowMs: 7_000,
        roundWindow: window,
      }),
    ).toBe(false);
  });
});

describe("buildRoundResults", () => {
  const window = makeWindow(0, 30_000);
  const players = ["alice", "bob", "carol"];

  it("awards points for correct answers and zero for wrong", () => {
    const answers: Record<string, PlayerAnswer> = {
      alice: { optionId: "song-1", answeredAtMs: 15_000 },
      bob: { optionId: "song-2", answeredAtMs: 10_000 },
    };

    const results = buildRoundResults(players, answers, "song-1", window);

    expect(results.alice.isCorrect).toBe(true);
    expect(results.alice.points).toBe(300);

    expect(results.bob.isCorrect).toBe(false);
    expect(results.bob.points).toBe(0);
  });

  it("gives null responseMs and zero points for unanswered players", () => {
    const results = buildRoundResults(players, {}, "song-1", window);

    expect(results.carol.responseMs).toBeNull();
    expect(results.carol.points).toBe(0);
    expect(results.carol.isCorrect).toBe(false);
  });

  it("clamps responseMs within the round window", () => {
    const answers: Record<string, PlayerAnswer> = {
      alice: { optionId: "song-1", answeredAtMs: 15_000 },
    };

    const results = buildRoundResults(players, answers, "song-1", window);
    expect(results.alice.responseMs).toBe(15_000);
    expect(results.alice.responseMs).toBeLessThanOrEqual(30_000);
  });
});

describe("findFirstCorrectSummary", () => {
  const window = makeWindow(0, 30_000);

  it("returns null when nobody answered correctly", () => {
    const answers: Record<string, PlayerAnswer> = {
      alice: { optionId: "song-2", answeredAtMs: 5_000 },
    };
    const results = buildRoundResults(["alice"], answers, "song-1", window);
    const summary = findFirstCorrectSummary(["alice"], results);

    expect(summary.playerId).toBeNull();
    expect(summary.responseMs).toBeNull();
  });

  it("returns the earliest correct answerer", () => {
    const answers: Record<string, PlayerAnswer> = {
      alice: { optionId: "song-1", answeredAtMs: 10_000 },
      bob: { optionId: "song-1", answeredAtMs: 5_000 },
    };
    const results = buildRoundResults(
      ["alice", "bob"],
      answers,
      "song-1",
      window,
    );
    const summary = findFirstCorrectSummary(["alice", "bob"], results);

    expect(summary.playerId).toBe("bob");
    expect(summary.responseMs).toBe(5_000);
  });

  it("tie-breaks by playerId alphabetically", () => {
    const answers: Record<string, PlayerAnswer> = {
      alice: { optionId: "song-1", answeredAtMs: 5_000 },
      bob: { optionId: "song-1", answeredAtMs: 5_000 },
    };
    const results = buildRoundResults(
      ["alice", "bob"],
      answers,
      "song-1",
      window,
    );
    const summary = findFirstCorrectSummary(["alice", "bob"], results);

    expect(summary.playerId).toBe("alice");
  });
});

describe("rankPlayers", () => {
  it("sorts by points descending", () => {
    const scoreboard = {
      alice: { points: 300, totalResponseMs: 10_000, answeredRounds: 2 },
      bob: { points: 500, totalResponseMs: 8_000, answeredRounds: 2 },
    };
    const ranking = rankPlayers(scoreboard);
    expect(ranking).toEqual(["bob", "alice"]);
  });

  it("tie-breaks by average response time (lower is better)", () => {
    const scoreboard = {
      alice: { points: 400, totalResponseMs: 20_000, answeredRounds: 2 },
      bob: { points: 400, totalResponseMs: 10_000, answeredRounds: 2 },
    };
    const ranking = rankPlayers(scoreboard);
    expect(ranking).toEqual(["bob", "alice"]);
  });

  it("tie-breaks by playerId alphabetically when all else equal", () => {
    const scoreboard = {
      bob: { points: 400, totalResponseMs: 10_000, answeredRounds: 2 },
      alice: { points: 400, totalResponseMs: 10_000, answeredRounds: 2 },
    };
    const ranking = rankPlayers(scoreboard);
    expect(ranking).toEqual(["alice", "bob"]);
  });

  it("handles zero answered rounds (avg = Infinity)", () => {
    const scoreboard = {
      alice: { points: 0, totalResponseMs: 0, answeredRounds: 0 },
      bob: { points: 100, totalResponseMs: 5_000, answeredRounds: 1 },
    };
    const ranking = rankPlayers(scoreboard);
    expect(ranking).toEqual(["bob", "alice"]);
  });
});
