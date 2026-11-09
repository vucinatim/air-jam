import { createAirJamAgentEvaluator } from "@air-jam/sdk/agent-tooling";
import { beforeEach, describe, expect, it } from "vitest";
import { agentContract } from "../../../src/game/contracts/agent";
import { gameStore } from "../../../src/game/stores/code-review-store";
import { testing } from "../../../src/testing/profiles";

const player = {
  actorId: "alpha",
  role: "controller" as const,
  connectedPlayerIds: ["alpha"],
};
const host = { ...player, actorId: "host", role: "host" as const };

beforeEach(() => gameStore.getState().actions.resetGame(host, undefined));

describe("Code Review launch", () => {
  it("requires a human and an opponent, then starts from a controller", () => {
    const actions = gameStore.getState().actions;
    actions.startMatch(player, undefined);
    expect(gameStore.getState().matchPhase).toBe("lobby");
    actions.setBotCount(player, { team: "team2", count: 1 });
    actions.startMatch(player, undefined);
    expect(gameStore.getState().matchPhase).toBe("lobby");
    actions.joinTeam(player, { team: "team1" });
    actions.startMatch(player, undefined);
    expect(gameStore.getState().matchPhase).toBe("playing");
    actions.scorePoint(host, { team: "team1" });
    actions.startMatch(player, undefined);
    expect(gameStore.getState().scores.team1).toBe(1);
    actions.finishMatch(host, undefined);
    actions.startMatch(player, undefined);
    expect(gameStore.getState().matchPhase).toBe("ended");
    // The existing rematch UI returns to lobby before starting again.
    actions.resetToLobby(player, undefined);
    actions.startMatch(player, undefined);
    expect(gameStore.getState().matchPhase).toBe("playing");
  });

  it("does not start from a stale disconnected team assignment", () => {
    const actions = gameStore.getState().actions;
    actions.joinTeam(player, { team: "team1" });
    actions.setBotCount(player, { team: "team2", count: 1 });
    actions.startMatch({ ...host, connectedPlayerIds: [] }, undefined);
    expect(gameStore.getState().matchPhase).toBe("lobby");
  });

  it("advertises score staging on the host lane, preserving player authority", async () => {
    expect(agentContract.actions.award_point.target.kind).toBe("host");
    const actions = gameStore.getState().actions;
    actions.scorePoint(player, { team: "team1" });
    expect(gameStore.getState().scores.team1).toBe(0);
    const snapshot = await agentContract.projectSnapshot({
      controllerId: "alpha",
      stores: { default: gameStore.getState() },
    });
    expect(snapshot.availableActions).toContain("host:award_point");
  });
});

it("seats all four brawlers after a solo round leaves its bot in the room", () => {
  const runSetup = (profileId: "round" | "brawl") => {
    const profile = testing.profiles[profileId];
    const connectedPlayerIds = profile.seats.map((seat) => seat.id);
    for (const step of profile.setup) {
      if (step.lane !== "participant")
        throw new Error("Expected participant setup");
      const { target, payload } = createAirJamAgentEvaluator(
        agentContract,
      ).resolve(
        step.actionId,
        "input" in step ? step.input : undefined,
        "code-review",
      );
      const handler = Reflect.get(
        gameStore.getState().actions,
        target.actionName,
      );
      handler(
        { actorId: step.seatId, role: "controller", connectedPlayerIds },
        payload,
      );
    }
  };
  runSetup("round");
  expect(gameStore.getState().botCounts.team2).toBe(1);
  gameStore.getState().actions.scorePoint(host, { team: "team2" });
  runSetup("brawl");
  expect(gameStore.getState().matchPhase).toBe("playing");
  expect(gameStore.getState().botCounts).toEqual({ team1: 0, team2: 0 });
  expect(Object.keys(gameStore.getState().teamAssignments).sort()).toEqual([
    "coder1",
    "coder2",
    "reviewer1",
    "reviewer2",
  ]);
});
