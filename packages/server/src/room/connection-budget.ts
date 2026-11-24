import type { RoomLimits } from "@air-jam/sdk/room-protocol";

export type FrameLane = "input" | "state" | "frame";

const WINDOW_MS = 1000;

const laneLimit = (limits: RoomLimits, lane: FrameLane): number =>
  lane === "input"
    ? limits.inputsPerSecond
    : lane === "state"
      ? limits.statesPerSecond
      : limits.framesPerSecond;

/**
 * One connection's rates, counted in fixed one-second windows of the time the
 * room is given. A frame over its lane's rate, or one that does not parse, is
 * a strike; too many strikes in one window end the connection.
 */
export class ConnectionBudget {
  private windowStart: number;
  private readonly counts = { input: 0, state: 0, frame: 0 };
  private strikes = 0;

  constructor(
    private readonly limits: RoomLimits,
    now: number,
  ) {
    this.windowStart = now;
  }

  /** Whether one more frame on `lane` fits within its rate. */
  admit(lane: FrameLane, now: number): boolean {
    this.advance(now);
    this.counts[lane] += 1;
    return this.counts[lane] <= laneLimit(this.limits, lane);
  }

  /** Records a dropped frame; true when the connection has broken its limits. */
  strike(now: number): boolean {
    this.advance(now);
    this.strikes += 1;
    return this.strikes > this.limits.strikesPerSecond;
  }

  private advance(now: number): void {
    if (now - this.windowStart < WINDOW_MS) return;
    this.windowStart = now;
    this.counts.input = 0;
    this.counts.state = 0;
    this.counts.frame = 0;
    this.strikes = 0;
  }
}
