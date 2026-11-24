import type { RoomLimits } from "@air-jam/sdk/room-protocol";

export type FrameLane = "input" | "state" | "frame";

/** What the room does with one arriving frame. */
export type Admission = "admitted" | "over-rate" | "flooded";

const WINDOW_MS = 1000;
/** The flood allowance earns this many times the lane's rate each second. */
const FLOOD_EARNING_FACTOR = 2;
/** Seconds of the lane's rate the allowance starts with. */
const FLOOD_START_SECONDS = 10;
/** Seconds of the lane's rate the allowance holds at most. */
const FLOOD_CAPACITY_SECONDS = 30;

const laneLimit = (limits: RoomLimits, lane: FrameLane): number =>
  lane === "input"
    ? limits.inputsPerSecond
    : lane === "state"
      ? limits.statesPerSecond
      : limits.framesPerSecond;

const LANES: readonly FrameLane[] = ["input", "state", "frame"];

/**
 * One connection's rates, against the time the room is given.
 *
 * Each lane admits its rate in fixed one-second windows; a frame past it is
 * over-rate and dropped without blame, because a network stall delivers a
 * phone's buffered frames in one burst. Every arrival, admitted, dropped or
 * ignored, also spends the lane's flood allowance, which earns twice the lane's rate each
 * second the connection lives: a stall's backlog was earned while the
 * connection was silent, so only a connection that keeps sending well over
 * its rate runs the allowance out and floods.
 *
 * Frames that do not parse are strikes, counted per second as before.
 */
export class ConnectionBudget {
  private windowStart: number;
  private readonly counts: Record<FrameLane, number> = {
    input: 0,
    state: 0,
    frame: 0,
  };
  private readonly allowance: Record<FrameLane, number>;
  private allowanceAt: number;
  private strikes = 0;

  constructor(
    private readonly limits: RoomLimits,
    now: number,
  ) {
    this.windowStart = now;
    this.allowanceAt = now;
    this.allowance = {
      input: laneLimit(limits, "input") * FLOOD_START_SECONDS,
      state: laneLimit(limits, "state") * FLOOD_START_SECONDS,
      frame: laneLimit(limits, "frame") * FLOOD_START_SECONDS,
    };
  }

  /** When the current rate window ends and over-rate lanes take frames again. */
  get windowEndsAt(): number {
    return this.windowStart + WINDOW_MS;
  }

  admit(lane: FrameLane, now: number): Admission {
    if (!this.spend(lane, now)) return "flooded";
    return this.fits(lane, now) ? "admitted" : "over-rate";
  }

  /** Spends one arrival from the lane's flood allowance, as a frame the room ignores does; false once it runs out. */
  spend(lane: FrameLane, now: number): boolean {
    this.earn(now);
    this.allowance[lane] -= 1;
    return this.allowance[lane] >= 0;
  }

  /** Takes a frame that arrived earlier into the rate window, without spending allowance again. */
  fits(lane: FrameLane, now: number): boolean {
    this.advance(now);
    this.counts[lane] += 1;
    return this.counts[lane] <= laneLimit(this.limits, lane);
  }

  /** Records a frame that did not parse; true when the connection has broken its limits. */
  strike(now: number): boolean {
    this.advance(now);
    this.strikes += 1;
    return this.strikes > this.limits.strikesPerSecond;
  }

  private earn(now: number): void {
    const seconds = (now - this.allowanceAt) / 1000;
    this.allowanceAt = now;
    if (seconds <= 0) return;
    for (const lane of LANES) {
      const rate = laneLimit(this.limits, lane);
      this.allowance[lane] = Math.min(
        rate * FLOOD_CAPACITY_SECONDS,
        this.allowance[lane] + rate * FLOOD_EARNING_FACTOR * seconds,
      );
    }
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
