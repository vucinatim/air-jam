import { agentContract } from "@/game/contracts/agent";
import { useGameStore } from "@/game/stores/create-store";
import { describe, expect, it } from "vitest";

describe("Last Band Standing agent snapshot", () => {
  it("never tells a player which option is correct during a round", async () => {
    const playerIds = ["player-01", "player-02"];
    const host = {
      actorId: "host",
      role: "host" as const,
      connectedPlayerIds: playerIds,
    };
    const { actions } = useGameStore.getState();
    actions.resetLobby(host, undefined);
    actions.setPlayers(host, {
      players: playerIds.map((id) => ({ id, label: id })),
    });
    for (const playerId of playerIds)
      actions.setReady(
        {
          actorId: playerId,
          role: "controller",
          connectedPlayerIds: playerIds,
        },
        { ready: true },
      );
    actions.startMatch(host, undefined);
    const round = useGameStore.getState().currentRound;
    if (!round) throw new Error("Expected round one.");
    actions.completeMatchCountdown(host, { nowMs: round.startedAtMs });

    const snapshot = await agentContract.projectSnapshot({
      controllerId: "player-01",
      stores: { default: useGameStore.getState() },
    });
    const live = JSON.stringify((snapshot as { round: unknown }).round);
    expect(live).toContain(round.songId);
    expect(live.split(round.songId)).toHaveLength(2);
  });
});
