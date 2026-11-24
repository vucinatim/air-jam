import { z } from "zod";

export const MAXIMUM_ROOM_SEATS = 16;

const count = z.number().int().positive();
const duration = z.number().int().nonnegative();

/**
 * What a room enforces, fixed when it opens. Every host enforces the same
 * object against the time it passes in; hosted policy may tighten it per
 * account or app without the room knowing why.
 */
export const roomLimitsSchema = z
  .object({
    seats: count.max(MAXIMUM_ROOM_SEATS),
    channels: count,
    /** How often a phone may send its controls; phones coalesce to it. */
    inputIntervalMs: count,
    /** One phone's whole control state; a host input record states its length in one byte. */
    inputBytes: count.max(255),
    inputsPerSecond: count,
    /** The most a channel's document, or any one state frame, may weigh. */
    stateBytes: count,
    statesPerSecond: count,
    /** The most any other text frame may weigh. */
    frameBytes: count,
    /** Text frames other than state, per connection. */
    framesPerSecond: count,
    /** Frames that do not parse, within one second, before the connection is closed. */
    strikesPerSecond: count,
    seatHoldMs: duration,
    hostGraceMs: duration,
    maximumAgeMs: count,
  })
  .strict();

export type RoomLimits = z.infer<typeof roomLimitsSchema>;

export const DEFAULT_ROOM_LIMITS: RoomLimits = Object.freeze({
  seats: MAXIMUM_ROOM_SEATS,
  channels: 8,
  inputIntervalMs: 16,
  inputBytes: 64,
  inputsPerSecond: 120,
  stateBytes: 65_536,
  statesPerSecond: 60,
  frameBytes: 8_192,
  framesPerSecond: 60,
  strikesPerSecond: 64,
  seatHoldMs: 120_000,
  hostGraceMs: 60_000,
  maximumAgeMs: 24 * 60 * 60 * 1000,
});
