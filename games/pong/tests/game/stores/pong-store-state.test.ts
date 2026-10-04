import { afterEach, describe, expect, it, vi } from "vitest";
import { agentContract } from "../../../src/game/contracts/agent";
import { usePongStore } from "../../../src/game/stores/pong-store";
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

  it("only allows the host to award points during play", () => {
    const player = {
      actorId: "alpha",
      role: "controller" as const,
      connectedPlayerIds: ["alpha"],
    };
    const actions = usePongStore.getState().actions;
    actions.returnToLobby(player, undefined);
    actions.joinTeam(player, { team: "team1" });
    actions.setBotCount(player, { team: "team2", count: 1 });
    actions.startMatch(player, undefined);
    expect(usePongStore.getState().matchPhase).toBe("playing");
    actions.scorePoint(player, { team: "team1" });
    expect(usePongStore.getState().scores.team1).toBe(0);
    actions.scorePoint({ ...player, role: "host" }, { team: "team1" });
    expect(usePongStore.getState().scores.team1).toBe(1);
    expect(agentContract.actions.award_point.target.kind).toBe("host");
    actions.returnToLobby(player, undefined);
  });

  it.each(["lobby", "playing", "ended"] as const)(
    "reports start readiness accurately in %s",
    async (matchPhase) => {
      const snapshot = await agentContract.projectSnapshot({
        controllerId: "alpha",
        stores: {
          default: createState({
            matchPhase,
            teamAssignments: { alpha: { team: "team1", position: "front" } },
            botCounts: { team1: 0, team2: 1 },
          }),
        },
      });
      expect(snapshot.canStartMatch).toBe(matchPhase === "lobby");
      expect(snapshot.availableActions).toContain("host:award_point");
    },
  );

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
