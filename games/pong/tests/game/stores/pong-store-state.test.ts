import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInitialPongState,
  reduceJoinTeam,
  reduceSetBotCount,
  reduceStartMatch,
} from "../../../src/game/stores/pong-store-state";
import type { PongState } from "../../../src/game/stores/pong-store-types";

const createState = (overrides: Partial<PongState> = {}): PongState => ({
  ...createInitialPongState(),
  actions: {} as PongState["actions"],
  ...overrides,
});

describe("pong store state transitions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts the match only when both teams are ready", () => {
    vi.spyOn(Date, "now").mockReturnValue(42_000);

    const result = reduceStartMatch(
      createState({
        teamAssignments: {
          hostA: { team: "team1", position: "front" },
          hostB: { team: "team2", position: "front" },
        },
      }),
      ["hostA", "hostB"],
    );

    expect(result).toEqual({
      scores: { team1: 0, team2: 0 },
      matchPhase: "playing",
      matchSummary: null,
      matchStartedAtMs: 42_000,
      teamAssignments: {
        hostA: { team: "team1", position: "front" },
        hostB: { team: "team2", position: "front" },
      },
    });
  });

  it("refuses to start if one team is still missing", () => {
    const state = createState({
      teamAssignments: {
        hostA: { team: "team1", position: "front" },
      },
    });

    expect(reduceStartMatch(state, ["hostA"])).toEqual(state);
  });

  it("allows mixed humans and bots up to two slots per team", () => {
    const withBots = reduceSetBotCount(createState(), {
      connectedPlayerIds: [],
      team: "team1",
      count: 1,
    });

    const withHuman = reduceJoinTeam(createState(withBots), {
      actorId: "hostA",
      connectedPlayerIds: ["hostA"],
      team: "team1",
    });

    expect(withHuman).toEqual({
      teamAssignments: {
        hostA: { team: "team1", position: "front" },
      },
    });

    const fullTeam = reduceSetBotCount(
      createState({
        ...withHuman,
        botCounts: { team1: 1, team2: 0 },
      }),
      {
        connectedPlayerIds: ["hostA"],
        team: "team1",
        count: 2,
      },
    );

    expect(fullTeam).toMatchObject({
      botCounts: { team1: 1, team2: 0 },
      teamAssignments: {
        hostA: { team: "team1", position: "front" },
      },
    });
  });
});
