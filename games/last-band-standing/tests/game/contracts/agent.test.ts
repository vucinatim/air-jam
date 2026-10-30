import { agentContract } from "@/game/contracts/agent";
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

describe("Last Band Standing agent snapshot", () => {
  it("never tells a player which option is correct during a round", async () => {
    const playerIds = ["player-01", "player-02"];
    const host = {
      actorId: "host",
      role: "host" as const,
      connectedPlayerIds: playerIds,
      settings,
      now: 0,
    };
    const { actions } = gameStore.getState();
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
          settings,
          now: 0,
        },
        { ready: true },
      );
    actions.startMatch(host, undefined);
    const round = gameStore.getState().currentRound;
    if (!round) throw new Error("Expected round one.");
    actions.advanceClock({ ...host, now: round.startedAtMs }, undefined);

    const snapshot = await agentContract.projectSnapshot({
      controllerId: "player-01",
      stores: { default: gameStore.getState() },
    });
    const live = JSON.stringify((snapshot as { round: unknown }).round);
    expect(live).toContain(round.songId);
    expect(live.split(round.songId)).toHaveLength(2);
  });
});
