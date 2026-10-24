import { defineAirJamSimulation } from "@air-jam/sdk/core";
import { gameStore } from "../stores/create-store";

export interface RoundClock {
  timeMs: number;
}

/**
 * Moves the match through its countdown, rounds and reveals on game time:
 * each step asks the store to apply whatever is due.
 */
export const roundClock = defineAirJamSimulation<RoundClock>({
  stepMs: 100,
  create: () => ({ timeMs: 0 }),
  step: (clock, { tick, stepMs }) => {
    clock.timeMs = tick * stepMs;
    void gameStore.actions.advanceClock();
  },
});
