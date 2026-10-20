import type { PlayerProfile, RuntimeState } from "../protocol";

/** What one simulation step can read and do. */
export interface AirJamStepContext<TInput, TEvent> {
  /** Steps taken since the simulation was created, starting at 1. */
  tick: number;
  stepMs: number;
  dtSeconds: number;
  /** Seeded randomness: the same seed and inputs replay the same game. */
  random: () => number;
  /** The latest input of a player, as the input schema parsed it. */
  input: (controllerId: string) => TInput | undefined;
  players: readonly PlayerProfile[];
  runtimeState: RuntimeState;
  /** Reports something that happened, such as a hit, for sound and feedback. */
  emit: (event: TEvent) => void;
}

/**
 * A game's authoritative simulation: state the host advances in fixed steps
 * on the SDK's clock. Drawing reads it and never advances it, so the same
 * game runs in a browser, headless, or faster than real time.
 */
export interface AirJamSimulation<TSim, TInput = unknown, TEvent = never> {
  /** Milliseconds of game time per step. */
  stepMs: number;
  create(context: { random: () => number }): TSim;
  step(sim: TSim, context: AirJamStepContext<TInput, TEvent>): void;
}

export const defineAirJamSimulation = <TSim, TInput = unknown, TEvent = never>(
  simulation: AirJamSimulation<TSim, TInput, TEvent>,
): AirJamSimulation<TSim, TInput, TEvent> => simulation;

/** Deterministic 32-bit generator (mulberry32). */
export const createSeededRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

export interface SimulationFrame<TSim> {
  sim: TSim;
  tick: number;
  /** How far drawing is between the last step and the next, from 0 to 1. */
  alpha: number;
}

/** How closely real-time play keeps up: steps dropped mean slow motion. */
export interface SimulationPace {
  frames: number;
  wallMs: number;
  simulatedMs: number;
}

interface ClockRoom<TInput> {
  input: (controllerId: string) => TInput | undefined;
  players: () => readonly PlayerProfile[];
  runtimeState: () => RuntimeState;
}

const MAX_FRAME_DELTA_MS = 250;
const MAX_STEPS_PER_FRAME = 5;

/**
 * Advances one simulation. Real-time play calls `frame` once per display
 * frame; tests and replays call `advance` with any amount of game time.
 */
export class SimulationClock<TSim, TInput = unknown, TEvent = never> {
  readonly seed: number;
  readonly sim: TSim;
  readonly pace: SimulationPace = { frames: 0, wallMs: 0, simulatedMs: 0 };
  private tick = 0;
  private accumulatorMs = 0;
  private lastFrameAt: number | null = null;
  private readonly random: () => number;
  private readonly eventListeners = new Set<(event: TEvent) => void>();
  private readonly frameListeners = new Set<
    (frame: SimulationFrame<TSim>) => void
  >();

  constructor(
    private readonly simulation: AirJamSimulation<TSim, TInput, TEvent>,
    private readonly room: ClockRoom<TInput>,
    seed: number,
  ) {
    this.seed = seed >>> 0;
    this.random = createSeededRandom(this.seed);
    this.sim = simulation.create({ random: this.random });
  }

  get ticks(): number {
    return this.tick;
  }

  /** Runs as many whole steps as `ms` of game time holds, without a cap. */
  advance(ms: number): void {
    this.accumulatorMs += ms;
    while (this.accumulatorMs >= this.simulation.stepMs) {
      this.accumulatorMs -= this.simulation.stepMs;
      this.step();
    }
    this.notifyFrame();
  }

  /** Advances by real elapsed time, dropping steps a slow device cannot run. */
  frame(now: number): void {
    const elapsedMs =
      this.lastFrameAt === null ? 0 : Math.max(0, now - this.lastFrameAt);
    this.lastFrameAt = now;
    const stepMs = this.simulation.stepMs;
    this.accumulatorMs += Math.min(
      elapsedMs,
      Math.max(stepMs, MAX_FRAME_DELTA_MS),
    );
    let steps = 0;
    while (this.accumulatorMs >= stepMs && steps < MAX_STEPS_PER_FRAME) {
      this.accumulatorMs -= stepMs;
      this.step();
      steps += 1;
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulatorMs = 0;
    this.pace.frames += 1;
    this.pace.wallMs += elapsedMs;
    this.pace.simulatedMs += steps * stepMs;
    this.notifyFrame();
  }

  /** Forgets the last frame time, so a resumed loop does not count the gap. */
  rest(): void {
    this.lastFrameAt = null;
  }

  onEvent(listener: (event: TEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onFrame(listener: (frame: SimulationFrame<TSim>) => void): () => void {
    this.frameListeners.add(listener);
    return () => this.frameListeners.delete(listener);
  }

  private step(): void {
    this.tick += 1;
    const stepMs = this.simulation.stepMs;
    this.simulation.step(this.sim, {
      tick: this.tick,
      stepMs,
      dtSeconds: stepMs / 1000,
      random: this.random,
      input: this.room.input,
      players: this.room.players(),
      runtimeState: this.room.runtimeState(),
      emit: (event) => {
        for (const listener of this.eventListeners) listener(event);
      },
    });
  }

  private notifyFrame(): void {
    if (this.frameListeners.size === 0) return;
    const frame = {
      sim: this.sim,
      tick: this.tick,
      alpha: Math.min(1, this.accumulatorMs / this.simulation.stepMs),
    };
    for (const listener of this.frameListeners) listener(frame);
  }
}
