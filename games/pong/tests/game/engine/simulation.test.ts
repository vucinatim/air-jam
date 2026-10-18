import { expect, it, vi } from "vitest";
import { FIELD_WIDTH } from "../../../src/game/engine/constants";
import {
  createRuntimeState,
  resetBall,
} from "../../../src/game/engine/runtime-state";
import { stepGame } from "../../../src/game/engine/simulation";

it("awards one goal across consecutive fixed steps before the host updates its countdown", () => {
  const state = createRuntimeState();
  state.ballX = FIELD_WIDTH;
  state.ballVX = 0;
  state.ballVY = 0;
  const onScore = vi.fn();
  const tick = () =>
    stepGame({
      state,
      players: [{ id: "player" }],
      teamAssignments: { player: { team: "team2", position: "front" } },
      botCounts: { team1: 0, team2: 0 },
      getInput: () => ({ direction: 1 }),
      isPlaying: true,
      countdown: null,
      deltaSeconds: 1 / 60,
      onScore,
    });
  for (let index = 0; index < 5; index++) tick();
  expect(onScore).toHaveBeenCalledExactlyOnceWith("team1");
  expect(state.ballX).toBe(FIELD_WIDTH);
  expect(state.paddle2FrontY).toBeGreaterThan(250);
  resetBall(state);
  state.ballX = -1;
  state.ballVX = 0;
  state.ballVY = 0;
  for (let index = 0; index < 5; index++) tick();
  expect(onScore.mock.calls).toEqual([["team1"], ["team2"]]);
});
