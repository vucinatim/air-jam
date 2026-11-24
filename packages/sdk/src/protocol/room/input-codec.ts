import type {
  AirJamButtonState,
  AirJamInput,
  AirJamInputState,
  AirJamVector,
} from "../../core/input";
import { seatIdFromNumber, seatNumberFromId, type SeatId } from "./seat-id";

/**
 * Input is binary and the room never decodes it. A phone sends one frame of
 * its whole control state: a kind byte, then each declared control in
 * declaration order. A stick is two signed bytes and an axis one, in
 * hundredths; a button is one byte, a down bit over a seven-bit press counter
 * the host unwraps. The room stamps the seat and forwards records to the host:
 * the kind byte, then per record two bytes of seat number, one of length and
 * the control bytes.
 */
export const INPUT_FRAME_KIND = 1;

const BUTTON_DOWN = 0x80;
const PRESS_COUNTER = 0x7f;
const RECORD_HEADER_BYTES = 3;

const controlBytes = (kind: AirJamInput[string]["kind"]): number =>
  kind === "stick" ? 2 : 1;

export const inputPayloadLength = (input: AirJamInput): number =>
  Object.values(input).reduce(
    (length, control) => length + controlBytes(control.kind),
    0,
  );

const toHundredths = (value: number): number =>
  Math.round(Math.max(-1, Math.min(1, value)) * 100);

/** The control bytes of one player's state, without the frame's kind byte. */
export const encodeInputPayload = (
  input: AirJamInput,
  state: AirJamInputState,
): Uint8Array => {
  const payload = new Uint8Array(inputPayloadLength(input));
  const view = new DataView(payload.buffer);
  let offset = 0;
  for (const control of Object.values(input)) {
    const value = state[control.name];
    if (control.kind === "button") {
      const button = (value as AirJamButtonState | undefined) ?? {
        down: false,
        presses: 0,
      };
      payload[offset] =
        (button.down ? BUTTON_DOWN : 0) | (button.presses & PRESS_COUNTER);
    } else if (control.kind === "axis") {
      view.setInt8(offset, toHundredths((value as number | undefined) ?? 0));
    } else {
      const vector = (value as AirJamVector | undefined) ?? { x: 0, y: 0 };
      view.setInt8(offset, toHundredths(vector.x));
      view.setInt8(offset + 1, toHundredths(vector.y));
    }
    offset += controlBytes(control.kind);
  }
  return payload;
};

/**
 * One player's state from its control bytes. `previous` is the state decoded
 * last for the same seat, against which press counters are unwrapped. Returns
 * null when the bytes do not fit the declared controls.
 */
export const decodeInputPayload = (
  input: AirJamInput,
  payload: Uint8Array,
  previous: AirJamInputState | null,
): AirJamInputState | null => {
  if (payload.byteLength !== inputPayloadLength(input)) return null;
  const view = new DataView(
    payload.buffer,
    payload.byteOffset,
    payload.byteLength,
  );
  const unit = (offset: number): number | null => {
    const hundredths = view.getInt8(offset);
    return Math.abs(hundredths) > 100 ? null : hundredths / 100;
  };
  const state: AirJamInputState = {};
  let offset = 0;
  for (const control of Object.values(input)) {
    if (control.kind === "button") {
      const byte = payload[offset] ?? 0;
      const before = previous?.[control.name] as AirJamButtonState | undefined;
      const counter = byte & PRESS_COUNTER;
      const presses = before
        ? before.presses +
          ((counter - (before.presses & PRESS_COUNTER) + PRESS_COUNTER + 1) &
            PRESS_COUNTER)
        : counter;
      state[control.name] = { down: (byte & BUTTON_DOWN) !== 0, presses };
    } else if (control.kind === "axis") {
      const value = unit(offset);
      if (value === null) return null;
      state[control.name] = value;
    } else {
      const x = unit(offset);
      const y = unit(offset + 1);
      if (x === null || y === null) return null;
      state[control.name] = { x, y };
    }
    offset += controlBytes(control.kind);
  }
  return state;
};

/** What a phone sends. */
export const encodePhoneInputFrame = (payload: Uint8Array): Uint8Array => {
  const frame = new Uint8Array(1 + payload.byteLength);
  frame[0] = INPUT_FRAME_KIND;
  frame.set(payload, 1);
  return frame;
};

/** What the room forwards to the host for one phone frame. */
export const encodeHostInputFrame = (
  seat: SeatId,
  phoneFrame: Uint8Array,
): Uint8Array => {
  const payloadLength = phoneFrame.byteLength - 1;
  const seatNumber = seatNumberFromId(seat);
  const frame = new Uint8Array(1 + RECORD_HEADER_BYTES + payloadLength);
  frame[0] = INPUT_FRAME_KIND;
  frame[1] = seatNumber >> 8;
  frame[2] = seatNumber & 0xff;
  frame[3] = payloadLength;
  frame.set(phoneFrame.subarray(1), 1 + RECORD_HEADER_BYTES);
  return frame;
};

/**
 * Packs host input frames that became ready together into one message. A
 * host that pays per message out uses it; the room itself never waits to
 * batch.
 */
export const joinHostInputFrames = (frames: Uint8Array[]): Uint8Array => {
  const records = frames.reduce(
    (length, frame) => length + frame.byteLength - 1,
    0,
  );
  const joined = new Uint8Array(1 + records);
  joined[0] = INPUT_FRAME_KIND;
  let offset = 1;
  for (const frame of frames) {
    joined.set(frame.subarray(1), offset);
    offset += frame.byteLength - 1;
  }
  return joined;
};

export interface HostInputRecord {
  seat: SeatId;
  payload: Uint8Array;
}

/** The records of a host input frame; throws when the frame is malformed. */
export const decodeHostInputFrame = (frame: Uint8Array): HostInputRecord[] => {
  if (frame[0] !== INPUT_FRAME_KIND) throw new Error("Not an input frame.");
  const records: HostInputRecord[] = [];
  let offset = 1;
  while (offset < frame.byteLength) {
    if (offset + RECORD_HEADER_BYTES > frame.byteLength)
      throw new Error("Truncated input record header.");
    const seatNumber = ((frame[offset] ?? 0) << 8) | (frame[offset + 1] ?? 0);
    const length = frame[offset + 2] ?? 0;
    const start = offset + RECORD_HEADER_BYTES;
    if (start + length > frame.byteLength)
      throw new Error("Truncated input record.");
    records.push({
      seat: seatIdFromNumber(seatNumber),
      payload: frame.subarray(start, start + length),
    });
    offset = start + length;
  }
  return records;
};
