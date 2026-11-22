import { describe, expect, it } from "vitest";
import { agentContract } from "../src/game/contracts/agent";
import { pongStore } from "../src/game/stores/pong-store";
import { testing } from "../src/testing/profiles";

describe("Pong test hand-back", () => {
  it("returns the creator's room to the lobby after every test profile", () => {
    for (const profile of Object.values(testing.profiles)) {
      expect(profile.handBack).toEqual([
        {
          lane: "participant",
          seatId: profile.seats[0].id,
          actionId: "return_to_lobby",
        },
      ]);
    }
    expect(agentContract.actions.return_to_lobby.target).toMatchObject({
      kind: "participant",
      actionName: "returnToLobby",
    });

    const player = {
      actorId: "alpha",
      role: "controller" as const,
      connectedPlayerIds: ["alpha"],
      now: 0,
      settings: {},
    };
    const actions = pongStore.getState().actions;
    actions.returnToLobby(player, undefined);
    actions.joinTeam(player, { team: "team1" });
    actions.setBotCount(player, { team: "team2", count: 1 });
    actions.startMatch(player, undefined);
    expect(pongStore.getState().matchPhase).toBe("playing");
    actions.returnToLobby(player, undefined);
    expect(pongStore.getState().matchPhase).toBe("lobby");
  });
});
