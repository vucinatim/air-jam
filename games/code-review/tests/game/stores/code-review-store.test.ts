import { beforeEach, describe, expect, it } from "vitest";
import { agentContract } from "../../../src/game/contracts/agent";
import { useGameStore } from "../../../src/game/stores/code-review-store";

const player = {
  actorId: "alpha",
  role: "controller" as const,
  connectedPlayerIds: ["alpha"],
};
const host = { ...player, actorId: "host", role: "host" as const };

beforeEach(() => useGameStore.getState().actions.resetGame(host, undefined));

describe("Code Review launch", () => {
  it("requires a human and an opponent, then starts from a controller", () => {
    const actions = useGameStore.getState().actions;
    actions.startMatch(player, undefined);
    expect(useGameStore.getState().matchPhase).toBe("lobby");
    actions.setBotCount(player, { team: "team2", count: 1 });
    actions.startMatch(player, undefined);
    expect(useGameStore.getState().matchPhase).toBe("lobby");
    actions.joinTeam(player, { team: "team1" });
    actions.startMatch(player, undefined);
    expect(useGameStore.getState().matchPhase).toBe("playing");
    actions.scorePoint(host, { team: "team1" });
    actions.startMatch(player, undefined);
    expect(useGameStore.getState().scores.team1).toBe(1);
    actions.finishMatch(host, undefined);
    actions.startMatch(player, undefined);
    expect(useGameStore.getState().matchPhase).toBe("ended");
    // The existing rematch UI returns to lobby before starting again.
    actions.resetToLobby(player, undefined);
    actions.startMatch(player, undefined);
    expect(useGameStore.getState().matchPhase).toBe("playing");
  });

  it("does not start from a stale disconnected team assignment", () => {
    const actions = useGameStore.getState().actions;
    actions.joinTeam(player, { team: "team1" });
    actions.setBotCount(player, { team: "team2", count: 1 });
    actions.startMatch({ ...host, connectedPlayerIds: [] }, undefined);
    expect(useGameStore.getState().matchPhase).toBe("lobby");
  });

  it("advertises score staging on the host lane, preserving player authority", async () => {
    expect(agentContract.actions.award_point.target.kind).toBe("host");
    const actions = useGameStore.getState().actions;
    actions.scorePoint(player, { team: "team1" });
    expect(useGameStore.getState().scores.team1).toBe(0);
    const snapshot = await agentContract.projectSnapshot({
      controllerId: "alpha",
      stores: { default: useGameStore.getState() },
    });
    expect(snapshot.availableActions).toContain("host:award_point");
  });
});
