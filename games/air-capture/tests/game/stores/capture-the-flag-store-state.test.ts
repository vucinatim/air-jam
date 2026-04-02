import { describe, expect, it } from "vitest";
import {
  createInitialCaptureTheFlagState,
  assignPlayerToTeam,
  reduceDropFlagAtPosition,
  reduceHandleBaseEntry,
  reduceManualScore,
  reduceRemovePlayer,
  reduceSetPlayerTeam,
  reduceTryPickupFlag,
  transitionHandleBaseEntry,
  transitionTryPickupFlag,
} from "../../../src/game/stores/match/capture-the-flag-store-state";
import type { CaptureTheFlagSnapshot } from "../../../src/game/domain/capture-the-flag";

const createState = (
  overrides: Partial<CaptureTheFlagSnapshot> = {},
): CaptureTheFlagSnapshot => ({
  ...createInitialCaptureTheFlagState({
    solaris: [10, 0, 0],
    nebulon: [-10, 0, 0],
  }),
  ...overrides,
});

describe("air-capture capture-the-flag store state", () => {
  it("assigns players to the least populated team", () => {
    const assigned = assignPlayerToTeam(
      createState({
        playerTeams: {
          p1: "solaris",
        },
      }),
      "p2",
    );

    expect(assigned.teamId).toBe("nebulon");
    expect(assigned.state.playerTeams.p2).toBe("nebulon");
  });

  it("returns dropped friendly flags to base", () => {
    const result = reduceTryPickupFlag(
      createState({
        playerTeams: { p1: "solaris" },
        flags: {
          solaris: {
            teamId: "solaris",
            status: "dropped",
            position: [3, 0, 4],
          },
          nebulon: {
            teamId: "nebulon",
            status: "atBase",
            position: [-10, 0, 0],
          },
        },
      }),
      "p1",
      "solaris",
    );

    expect(result.flags.solaris).toMatchObject({
      status: "atBase",
      position: [10, 0, 0],
    });
  });

  it("lets enemies pick up a flag", () => {
    const result = reduceTryPickupFlag(
      createState({
        playerTeams: { p1: "solaris" },
      }),
      "p1",
      "nebulon",
    );

    expect(result.flags.nebulon).toMatchObject({
      status: "carried",
      carrierId: "p1",
    });
  });

  it("blocks enemy flag pickup while your own flag is being carried", () => {
    const result = reduceTryPickupFlag(
      createState({
        playerTeams: { p1: "solaris", enemy: "nebulon" },
        flags: {
          solaris: {
            teamId: "solaris",
            status: "carried",
            position: [10, 0, 0],
            carrierId: "enemy",
          },
          nebulon: {
            teamId: "nebulon",
            status: "atBase",
            position: [-10, 0, 0],
          },
        },
      }),
      "p1",
      "nebulon",
    );

    expect(result.flags.nebulon).toMatchObject({
      status: "atBase",
    });
  });

  it("reports enemy flag pickups as an explicit interaction outcome", () => {
    const result = transitionTryPickupFlag(
      createState({
        playerTeams: { p1: "solaris" },
      }),
      "p1",
      "nebulon",
    );

    expect(result.outcome).toBe("pickedUpEnemyFlag");
    expect(result.state.flags.nebulon).toMatchObject({
      status: "carried",
      carrierId: "p1",
    });
  });

  it("reports friendly dropped-flag returns as an explicit interaction outcome", () => {
    const result = transitionTryPickupFlag(
      createState({
        playerTeams: { p1: "solaris" },
        flags: {
          solaris: {
            teamId: "solaris",
            status: "dropped",
            position: [3, 0, 4],
          },
          nebulon: {
            teamId: "nebulon",
            status: "atBase",
            position: [-10, 0, 0],
          },
        },
      }),
      "p1",
      "solaris",
    );

    expect(result.outcome).toBe("returnedFriendlyFlag");
    expect(result.state.flags.solaris).toMatchObject({
      status: "atBase",
      position: [10, 0, 0],
    });
  });

  it("scores when a carrier reaches their own base", () => {
    const result = reduceHandleBaseEntry(
      createState({
        playerTeams: { p1: "solaris" },
        flags: {
          solaris: {
            teamId: "solaris",
            status: "atBase",
            position: [10, 0, 0],
          },
          nebulon: {
            teamId: "nebulon",
            status: "carried",
            carrierId: "p1",
            position: [-10, 0, 0],
          },
        },
      }),
      "p1",
      "solaris",
      {
        solaris: [20, 0, 0],
        nebulon: [-20, 0, 0],
      },
    );

    expect(result.scores.solaris).toBe(1);
    expect(result.flags.nebulon).toMatchObject({
      status: "atBase",
      position: [-20, 0, 0],
    });
    expect(result.basePositions.solaris).toEqual([20, 0, 0]);
  });

  it("reports scoring as an explicit base-entry interaction outcome", () => {
    const result = transitionHandleBaseEntry(
      createState({
        playerTeams: { p1: "solaris" },
        flags: {
          solaris: {
            teamId: "solaris",
            status: "atBase",
            position: [10, 0, 0],
          },
          nebulon: {
            teamId: "nebulon",
            status: "carried",
            carrierId: "p1",
            position: [-10, 0, 0],
          },
        },
      }),
      "p1",
      "solaris",
      {
        solaris: [20, 0, 0],
        nebulon: [-20, 0, 0],
      },
    );

    expect(result.outcome).toBe("scoredPoint");
    expect(result.state.scores.solaris).toBe(1);
  });

  it("reports friendly flag recovery at base as an explicit interaction outcome", () => {
    const result = transitionHandleBaseEntry(
      createState({
        playerTeams: { p1: "solaris" },
        flags: {
          solaris: {
            teamId: "solaris",
            status: "dropped",
            position: [3, 0, 4],
          },
          nebulon: {
            teamId: "nebulon",
            status: "atBase",
            position: [-10, 0, 0],
          },
        },
      }),
      "p1",
      "solaris",
    );

    expect(result.outcome).toBe("returnedFriendlyFlag");
    expect(result.state.flags.solaris).toMatchObject({
      status: "atBase",
      position: [10, 0, 0],
    });
  });

  it("drops carried flags at a specific position", () => {
    const result = reduceDropFlagAtPosition(
      createState({
        flags: {
          solaris: {
            teamId: "solaris",
            status: "carried",
            position: [10, 0, 0],
            carrierId: "p1",
          },
          nebulon: {
            teamId: "nebulon",
            status: "atBase",
            position: [-10, 0, 0],
          },
        },
      }),
      "p1",
      [4, 5, 6],
    );

    expect(result.flags.solaris).toMatchObject({
      status: "dropped",
      carrierId: undefined,
      position: [4, 5, 6],
    });
  });

  it("removes a player and resets their carried flag", () => {
    const result = reduceRemovePlayer(
      createState({
        playerTeams: { p1: "solaris" },
        flags: {
          solaris: {
            teamId: "solaris",
            status: "carried",
            position: [1, 2, 3],
            carrierId: "p1",
          },
          nebulon: {
            teamId: "nebulon",
            status: "atBase",
            position: [-10, 0, 0],
          },
        },
      }),
      "p1",
    );

    expect(result.playerTeams).toEqual({});
    expect(result.flags.solaris).toMatchObject({
      status: "atBase",
      position: [10, 0, 0],
    });
  });

  it("updates only team ownership when explicitly reassigned", () => {
    const result = reduceSetPlayerTeam(
      createState({
        playerTeams: { p1: "solaris" },
      }),
      "p1",
      "nebulon",
    );

    expect(result.playerTeams.p1).toBe("nebulon");
  });

  it("applies manual score while preserving non-base flags", () => {
    const result = reduceManualScore(
      createState({
        flags: {
          solaris: {
            teamId: "solaris",
            status: "dropped",
            position: [1, 0, 1],
          },
          nebulon: {
            teamId: "nebulon",
            status: "atBase",
            position: [-10, 0, 0],
          },
        },
      }),
      "solaris",
      {
        solaris: [30, 0, 0],
        nebulon: [-30, 0, 0],
      },
    );

    expect(result.scores.solaris).toBe(1);
    expect(result.flags.solaris.position).toEqual([1, 0, 1]);
    expect(result.flags.nebulon.position).toEqual([-30, 0, 0]);
  });
});
