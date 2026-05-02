import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmptyTeamCounts } from "../../../src/game/domain/match-readiness";
import {
  MATCH_COUNTDOWN_DURATION_MS,
  createInitialMatchState,
  reduceEndMatch,
  reduceFinishCountdown,
  reduceJoinTeam,
  reduceSetBotCount,
  reduceStartMatch,
  reduceSyncConnectedPlayers,
} from "../../../src/game/stores/match/match-store-state";
import type { MatchStateSnapshot } from "../../../src/game/stores/match/match-store-types";

const createState = (
  overrides: Partial<MatchStateSnapshot> = {},
): MatchStateSnapshot => ({
  ...createInitialMatchState(),
  ...overrides,
});

describe("air-capture match store state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-assigns connected players into balanced teams", () => {
    const result = reduceSyncConnectedPlayers(createState(), {
      connectedPlayerIds: ["p1", "p2"],
    });

    expect(result.teamAssignments).toEqual({
      p1: { teamId: "solaris" },
      p2: { teamId: "nebulon" },
    });
  });

  it("prunes disconnected players during sync", () => {
    const result = reduceSyncConnectedPlayers(
      createState({
        teamAssignments: {
          p1: { teamId: "solaris" },
          p2: { teamId: "nebulon" },
        },
      }),
      {
        connectedPlayerIds: ["p1"],
      },
    );

    expect(result.teamAssignments).toEqual({
      p1: { teamId: "solaris" },
    });
  });

  it("caps bot count so humans and bots never exceed team capacity", () => {
    const result = reduceSetBotCount(
      createState({
        teamAssignments: {
          p1: { teamId: "solaris" },
        },
      }),
      {
        connectedPlayerIds: ["p1"],
        role: "host",
      },
      {
        teamId: "solaris",
        count: 2,
      },
    );

    expect(result.botCounts).toEqual({
      solaris: 1,
      nebulon: 0,
    });
  });

  it("refuses to move a player onto a full team", () => {
    const result = reduceJoinTeam(
      createState({
        botCounts: {
          solaris: 1,
          nebulon: 0,
        },
        teamAssignments: {
          p2: { teamId: "solaris" },
          p1: { teamId: "nebulon" },
        },
      }),
      {
        actorId: "p1",
        connectedPlayerIds: ["p1", "p2"],
      },
      {
        teamId: "solaris",
      },
    );

    expect(result.teamAssignments).toEqual({
      p2: { teamId: "solaris" },
      p1: { teamId: "nebulon" },
    });
  });

  it("moves a player when the requested team still has capacity", () => {
    const result = reduceJoinTeam(
      createState({
        botCounts: {
          solaris: 1,
          nebulon: 0,
        },
        teamAssignments: {
          p1: { teamId: "nebulon" },
        },
      }),
      {
        actorId: "p1",
        connectedPlayerIds: ["p1"],
      },
      {
        teamId: "solaris",
      },
    );

    expect(result.teamAssignments).toEqual({
      p1: { teamId: "solaris" },
    });
  });

  it("starts the match when both teams are occupied and at least one human is present", () => {
    vi.spyOn(Date, "now").mockReturnValue(42_000);

    const result = reduceStartMatch(
      createState({
        botCounts: {
          solaris: 0,
          nebulon: 1,
        },
        teamAssignments: {
          p1: { teamId: "solaris" },
        },
      }),
      {
        connectedPlayerIds: ["p1"],
      },
    );

    expect(result).toMatchObject({
      matchPhase: "countdown",
      countdownEndsAtMs: 42_000 + MATCH_COUNTDOWN_DURATION_MS,
      matchStartedAtMs: null,
      botCounts: {
        solaris: 0,
        nebulon: 1,
      },
      teamAssignments: {
        p1: { teamId: "solaris" },
      },
    });
  });

  it("finishes countdown into live play and stamps match start time", () => {
    vi.spyOn(Date, "now").mockReturnValue(45_000);

    const result = reduceFinishCountdown(
      createState({
        matchPhase: "countdown",
        countdownEndsAtMs: 45_000,
      }),
    );

    expect(result).toMatchObject({
      matchPhase: "playing",
      countdownEndsAtMs: null,
      matchStartedAtMs: 45_000,
    });
  });

  it("ends a running match with duration and summary", () => {
    vi.spyOn(Date, "now").mockReturnValue(55_000);

    const result = reduceEndMatch(
      createState({
        matchPhase: "playing",
        matchStartedAtMs: 50_000,
        pointsToWin: 7,
      }),
      {
        winner: "nebulon",
        finalScores: {
          solaris: 3,
          nebulon: 7,
        },
      },
    );

    expect(result).toEqual({
      ...createState({
        matchPhase: "playing",
        matchStartedAtMs: 50_000,
        pointsToWin: 7,
      }),
      matchPhase: "ended",
      matchStartedAtMs: null,
      matchSummary: {
        winner: "nebulon",
        finalScores: {
          solaris: 3,
          nebulon: 7,
        },
        pointsToWin: 7,
        durationMs: 5_000,
      },
    });
  });

  it("keeps the initial state minimal and explicit", () => {
    expect(createInitialMatchState()).toEqual({
      matchPhase: "lobby",
      pointsToWin: 3,
      botCounts: createEmptyTeamCounts(),
      teamAssignments: {},
      matchSummary: null,
      countdownEndsAtMs: null,
      matchStartedAtMs: null,
    });
  });
});
