import type { PrefabState } from "../prefabs/types";
export function advancePrefabClock(
  time: number,
  elapsed: number,
  state: PrefabState,
) {
  if (!state.seconds) return { time: 0, playing: false };
  const next = Math.max(0, time + elapsed);
  return state.loop
    ? { time: next % state.seconds, playing: true }
    : { time: Math.min(next, state.seconds), playing: next < state.seconds };
}
