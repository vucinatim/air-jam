/**
 * How well this page's fixed-step simulations keep up with real time. A host
 * that cannot render fast enough runs at most a few steps per frame and drops
 * the rest, so the game plays in slow motion; this makes that visible.
 */
export type HostPace = {
  /** Frames rendered while the simulation ran. */
  frames: number;
  /** Real time those frames spanned. */
  wallMs: number;
  /** Simulation time actually advanced in that span. */
  simulatedMs: number;
};

const loops = new Set<HostPace>();

/** Start counting one fixed-step loop; release it when the loop stops. */
export function trackHostSimulation() {
  const pace: HostPace = { frames: 0, wallMs: 0, simulatedMs: 0 };
  loops.add(pace);
  return { pace, release: () => loops.delete(pace) };
}

/** The loop furthest behind real time, or undefined when none has run. */
export function readHostPace(): HostPace | undefined {
  let slowest: HostPace | undefined;
  for (const pace of loops)
    if (
      pace.wallMs > 0 &&
      (!slowest ||
        pace.simulatedMs / pace.wallMs < slowest.simulatedMs / slowest.wallMs)
    )
      slowest = pace;
  return slowest && { ...slowest };
}
