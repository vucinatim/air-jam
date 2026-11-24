import type { AirJamInput, AirJamInputState } from "../core/input";
import {
  decodeHostInputFrame,
  decodeInputPayload,
  encodeInputPayload,
  encodePhoneInputFrame,
  type SeatId,
} from "../room-protocol";

/** A stick or axis must move this many hundredths to count, except to the centre or the rim. */
export const STICK_CHANGE_HUNDREDTHS = 2;
const RIM_HUNDREDTHS = 99.5;

type Change = "none" | "movement" | "edge";

const isMovement = (before: number[], after: number[]): boolean => {
  if (before.every((value, index) => value === after[index])) return false;
  const largest = Math.max(
    ...after.map((value, index) => Math.abs(value - (before[index] ?? 0))),
  );
  return (
    largest >= STICK_CHANGE_HUNDREDTHS ||
    after.every((value) => value === 0) ||
    Math.hypot(...after) >= RIM_HUNDREDTHS
  );
};

const signed = (byte: number | undefined): number =>
  byte === undefined ? 0 : byte > 127 ? byte - 256 : byte;

/**
 * A phone's controls on their way to the room. Phones send on change, at
 * most once per the room's input interval: a button edge goes at once,
 * because a press is the latency a player feels, while stick and axis
 * movement waits for the interval and counts only past the change threshold,
 * so a thumb held still sends nothing.
 */
export class PhoneInputLane {
  private latest: Uint8Array | null = null;
  private sent: Uint8Array | null = null;
  private sentAt = Number.NEGATIVE_INFINITY;

  constructor(private readonly layout: AirJamInput) {}

  update(state: AirJamInputState): void {
    this.latest = encodeInputPayload(this.layout, state);
  }

  /**
   * When the latest state should go out, or null when nothing worth sending
   * changed. `spacingMs` keeps edges within the room's input rate.
   */
  due(intervalMs: number, spacingMs: number): number | null {
    const change = this.change();
    if (change === "none") return null;
    return this.sentAt + (change === "edge" ? spacingMs : intervalMs);
  }

  /** The frame to send now, whether or not it changed; null before any state. */
  take(now: number): Uint8Array | null {
    if (this.latest === null) return null;
    this.sent = this.latest;
    this.sentAt = now;
    return encodePhoneInputFrame(this.latest);
  }

  private change(): Change {
    const latest = this.latest;
    if (latest === null) return "none";
    const sent = this.sent;
    if (sent === null) return "edge";
    let offset = 0;
    let change: Change = "none";
    for (const control of Object.values(this.layout)) {
      if (control.kind === "button") {
        if (latest[offset] !== sent[offset]) return "edge";
        offset += 1;
        continue;
      }
      const width = control.kind === "stick" ? 2 : 1;
      const before: number[] = [];
      const after: number[] = [];
      for (let index = 0; index < width; index += 1) {
        before.push(signed(sent[offset + index]));
        after.push(signed(latest[offset + index]));
      }
      if (isMovement(before, after)) change = "movement";
      offset += width;
    }
    return change;
  }
}

/**
 * A host's view of every seat's controls. Press counters travel wrapped, so
 * each seat's state is decoded against the one decoded before it.
 */
export class HostInputDecoder {
  private readonly bySeat = new Map<SeatId, AirJamInputState>();

  constructor(private readonly layout: AirJamInput) {}

  /** The seats' states in a host input frame; malformed records are skipped. */
  decode(frame: Uint8Array): Array<{ seat: SeatId; state: AirJamInputState }> {
    const decoded: Array<{ seat: SeatId; state: AirJamInputState }> = [];
    for (const record of decodeHostInputFrame(frame)) {
      const state = decodeInputPayload(
        this.layout,
        record.payload,
        this.bySeat.get(record.seat) ?? null,
      );
      if (state === null) continue;
      this.bySeat.set(record.seat, state);
      decoded.push({ seat: record.seat, state });
    }
    return decoded;
  }

  forget(seat: SeatId): void {
    this.bySeat.delete(seat);
  }
}
